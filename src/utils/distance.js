const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function getDistanceKm(origin, destination) {
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestStore(userLocation, stores) {
  if (!userLocation || !stores.length) return null;

  return stores
    .map((store) => ({
      ...store,
      distanceKm: getDistanceKm(userLocation, store)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

export function createDirectionsUrl(store) {
  return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
}
