import { getAllActivityTypes, getActivitySchedule, mergeSchedules } from './sinergiaApi.js';

export default async function handler(req, res) {
  try {
    const urlSearchParams = new URLSearchParams(req?.query || {});
    const noCache = urlSearchParams.get('nocache') === '1';
    const cacheMinutes = Number(urlSearchParams.get('cacheMinutes'));
    const ttlMs = Number.isFinite(cacheMinutes) && cacheMinutes > 0 ? cacheMinutes * 60 * 1000 : 5 * 60 * 1000;
    const defaultCompany = process.env.COMPANY_ID_DEFAULT || '5';
    const companyId = urlSearchParams.get('cId') || defaultCompany;

    const fetchOptions = { useCache: !noCache, ttlMs };

    const idParam = urlSearchParams.get('id');
    const ids = idParam ? idParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    let mergedSchedule;
    let calendarName = 'Sinergia Life - All Activities';

    if (ids.length > 0) {
      // Fetch and merge only the selected activities
      const schedules = await Promise.all(
        ids.map(id => getActivitySchedule(id, companyId, fetchOptions).catch(() => ({})))
      );
      mergedSchedule = mergeSchedules(schedules);
      if (ids.length === 1) {
        calendarName = `Sinergia Life - Activity ${ids[0]}`;
      } else {
        calendarName = `Sinergia Life - Selected Activities`;
      }
    } else {
      // Fetch all active activity types for the company then merge all
      const activityTypes = await getAllActivityTypes(fetchOptions, companyId);
      const schedules = await Promise.all(
        activityTypes.map(t => getActivitySchedule(t.id, companyId, fetchOptions).catch(() => ({})))
      );
      mergedSchedule = mergeSchedules(schedules);
    }

    const ics = generateICS(mergedSchedule, calendarName);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sinergia-calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(ics);
  } catch (error) {
    console.error('Error generating calendar:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
}

function generateICS(scheduleData, calendarName) {
  const now = new Date();
  const prodId = '-//Sinergia Life//Calendar//EN';
  const calName = calendarName || 'Sinergia Life Schedule';
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:America/Montevideo'
  ];

  // Day mapping from Spanish names to numbers
  const dayMap = {
    'Lunes': 1,    // Monday
    'Martes': 2,   // Tuesday
    'Miercoles': 3, // Wednesday
    'Jueves': 4,   // Thursday
    'Viernes': 5,  // Friday
    'Sabado': 6,   // Saturday
    'Domingo': 0   // Sunday
  };

  Object.entries(scheduleData || {}).forEach(([dayName, events]) => {
    if (!events || events.length === 0) return;
    const dayOfWeek = dayMap[dayName];
    if (dayOfWeek === undefined) return;

    events.forEach(event => {
      if (!event || event.status !== 'ACTIVE') return;

      const nextOccurrence = getNextWeekday(now, dayOfWeek);
      const startDateTime = parseTimeToDate(nextOccurrence, event.starttime);
      const endDateTime = parseTimeToDate(nextOccurrence, event.endtime);
      const uid = `${event.id}-${event.activityId}@sinergia.life.uy`;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${formatDateTime(startDateTime)}`,
        `DTEND:${formatDateTime(endDateTime)}`,
        `SUMMARY:${event.name}`,
        `LOCATION:${event.location}`,
        `DESCRIPTION:${event.name}\\nDuration: ${event.duration} minutes\\nGender: ${event.gender}\\nType: ${event.typeReservation}`,
        'RRULE:FREQ=WEEKLY;COUNT=52',
        `CREATED:${formatDateTime(now)}`,
        `LAST-MODIFIED:${formatDateTime(now)}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    });
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

function getNextWeekday(date, targetDay) {
  const result = new Date(date);
  const currentDay = result.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  if (daysUntilTarget === 0 && result.getTime() > date.getTime()) {
    result.setDate(result.getDate() + 7);
  } else {
    result.setDate(result.getDate() + daysUntilTarget);
  }
  return result;
}

function parseTimeToDate(date, timeStr) {
  const [hours, minutes] = String(timeStr || '00:00').split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
}

function formatDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}