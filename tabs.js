window.CampusHubUI ||= {};
window.CampusHubUI.tabs = { select(container,selector){ container?.querySelectorAll('[role="tab"],button[data-tab]').forEach(tab=>tab.classList.toggle('selected',tab.matches(selector))); } };
