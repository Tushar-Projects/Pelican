export function getDeviceName(fallback = 'Web Client') {
  try {
    let name = localStorage.getItem('pelican_device_name');
    if (!name) {
      const legacy = localStorage.getItem('droprelay_device_name');
      if (legacy) {
        name = legacy;
        localStorage.setItem('pelican_device_name', legacy);
        localStorage.removeItem('droprelay_device_name');
      }
    }
    return name || fallback;
  } catch (e) {
    return fallback;
  }
}

export function setDeviceName(name) {
  try {
    const trimmed = (name || '').trim();
    if (trimmed) {
      localStorage.setItem('pelican_device_name', trimmed);
    }
    localStorage.removeItem('droprelay_device_name');
  } catch (e) {}
}
