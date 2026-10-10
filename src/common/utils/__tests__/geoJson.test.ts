import { calculateAreaHectares, isUsableBoundary, isPointInsidePolygon } from '../geoJson';
import type { GeoJSONPolygon } from '../../../features/land/store/landSlice';
const rectangle = (latitude: number): GeoJSONPolygon => ({type:'Polygon',coordinates:[[[73,latitude],[73.001,latitude],[73.001,latitude+.001],[73,latitude+.001],[73,latitude]]]});
it('rejects malformed, unclosed and degenerate coordinates before rendering native maps', () => {
  for (const value of [null, {}, {type:'Polygon',coordinates:[[[73,20],[74,20],[74,21],[73,21]]]}, {type:'Polygon',coordinates:[[[73,20],[73,20],[73,20],[73,20]]]}]) expect(isUsableBoundary(value)).toBe(false);
  expect(isUsableBoundary(rectangle(30))).toBe(true);
});
it('uses the actual parcel latitude for approximate area instead of a constant 20 degrees', () => {
  const at20 = calculateAreaHectares(rectangle(20));
  const at30 = calculateAreaHectares(rectangle(30));
  expect(at30 / at20).toBeCloseTo(Math.cos(30*Math.PI/180)/Math.cos(20*Math.PI/180),4);
});
it('subtracts holes from the preview and excludes them from the audit geofence', () => {
  const polygon = rectangle(20);
  const outerArea = calculateAreaHectares(polygon);
  polygon.coordinates.push([[73.00025,20.00025],[73.00075,20.00025],[73.00075,20.00075],[73.00025,20.00075],[73.00025,20.00025]]);
  expect(calculateAreaHectares(polygon)).toBeCloseTo(outerArea*.75,5);
  expect(isPointInsidePolygon({lng:73.0005,lat:20.0005},polygon)).toBe(false);
  expect(isPointInsidePolygon({lng:73.0001,lat:20.0001},polygon)).toBe(true);
});
