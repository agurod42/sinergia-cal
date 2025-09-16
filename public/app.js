(function() {
  function getQueryParam(name, fallback) {
    const params = new URLSearchParams(location.search);
    return params.get(name) || fallback;
  }

  function buildBaseParams() {
    const cId = getQueryParam('cId', '5');
    const cacheMinutes = getQueryParam('cacheMinutes', '5');
    const nocache = getQueryParam('nocache', '0');
    const q = new URLSearchParams();
    if (cId) q.set('cId', cId);
    if (cacheMinutes) q.set('cacheMinutes', cacheMinutes);
    if (nocache) q.set('nocache', nocache);
    return q;
  }

  function calendarUrl(ids) {
    const q = buildBaseParams();
    const idsParam = Array.isArray(ids) ? ids.join(',') : String(ids || '').trim();
    if (idsParam) q.set('id', idsParam);
    return `/api/calendar?${q.toString()}`;
  }

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function titleCase(text) {
    return String(text || '')
      .toLowerCase()
      .split(/\s+/)
      .map(w => w ? w[0].toUpperCase() + w.slice(1) : w)
      .join(' ');
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  function groupByName(types) {
    const map = new Map(); // normName -> { name, displayName, ids }
    types.forEach(t => {
      const originalName = t.name || `Activity ${t.id}`;
      const norm = normalizeName(originalName);
      if (!map.has(norm)) {
        map.set(norm, { name: originalName, displayName: titleCase(originalName), ids: [] });
      }
      map.get(norm).ids.push(t.id);
    });
    return Array.from(map.values()).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
  }

  function createGroupCard(group, onToggle) {
    const div = document.createElement('div');
    div.className = 'card';

    const title = document.createElement('div');
    title.className = 'title';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `group-${slugify(group.name)}`;

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    const count = group.ids.length;
    label.textContent = count > 1 ? `${group.displayName} (${count})` : group.displayName;

    checkbox.addEventListener('change', () => onToggle(group, checkbox.checked));

    title.appendChild(checkbox);
    title.appendChild(label);

    div.appendChild(title);
    return div;
  }

  function setSubscribeEnabled(enabled, url) {
    const subscribe = document.getElementById('subscribe-selected');
    if (enabled) {
      subscribe.classList.remove('disabled');
      subscribe.setAttribute('aria-disabled', 'false');
      if (url) subscribe.href = url;
    } else {
      subscribe.classList.add('disabled');
      subscribe.setAttribute('aria-disabled', 'true');
      subscribe.href = '#';
    }
  }

  function updateGlobalLinks(selectedIds) {
    const hasSelection = selectedIds.length > 0;
    const url = hasSelection ? calendarUrl(selectedIds) : calendarUrl([]);

    setSubscribeEnabled(hasSelection, url);
  }

  async function bootstrap() {
    const grid = document.getElementById('grid');
    grid.textContent = 'Loading…';

    const selected = new Set();

    function setAllCheckbox(checked) {
      const allCb = document.getElementById('all-checkbox');
      allCb.checked = checked;
    }

    function bindToolbar(allIds, groups) {
      const btnSelectAll = document.getElementById('select-all');
      const btnClear = document.getElementById('clear');
      const allCb = document.getElementById('all-checkbox');

      btnSelectAll.addEventListener('click', () => {
        allIds.forEach(id => selected.add(id));
        document.querySelectorAll('input[type="checkbox"][id^="group-"]').forEach(cb => cb.checked = true);
        setAllCheckbox(true);
        updateGlobalLinks(Array.from(selected));
      });

      btnClear.addEventListener('click', () => {
        selected.clear();
        document.querySelectorAll('input[type="checkbox"][id^="group-"]').forEach(cb => cb.checked = false);
        setAllCheckbox(false);
        updateGlobalLinks(Array.from(selected));
      });

      allCb.addEventListener('change', () => {
        const check = allCb.checked;
        if (check) allIds.forEach(id => selected.add(id));
        else selected.clear();
        document.querySelectorAll('input[type="checkbox"][id^="group-"]').forEach(cb => cb.checked = check);
        updateGlobalLinks(Array.from(selected));
      });
    }

    function syncAllCheckbox(allIds) {
      const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
      setAllCheckbox(allChecked);
    }

    try {
      const q = buildBaseParams();
      const res = await fetch(`/api/types?${q.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load types');
      const json = await res.json();
      const types = (json && Array.isArray(json.types)) ? json.types : [];
      // group by name and sort groups by displayName
      const groups = groupByName(types);
      const allIds = types.map(t => t.id);

      grid.textContent = '';
      bindToolbar(allIds, groups);

      groups.forEach(g => {
        const card = createGroupCard(g, (group, isChecked) => {
          if (isChecked) group.ids.forEach(id => selected.add(id));
          else group.ids.forEach(id => selected.delete(id));
          syncAllCheckbox(allIds);
          updateGlobalLinks(Array.from(selected));
        });
        grid.appendChild(card);
      });

      // initialize links and states for none selected (all)
      updateGlobalLinks([]);

      if (groups.length === 0) {
        grid.textContent = 'No activity types available.';
      }
    } catch (err) {
      console.error(err);
      grid.textContent = 'Failed to load activity types.';
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
