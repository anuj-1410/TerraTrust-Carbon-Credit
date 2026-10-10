import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ZoneNavigationScreen from '../ZoneNavigationScreen';

const mockNavigate = jest.fn();
const mockPosition = { lat: 18.52, lng: 73.85 };
const mockGeofence = {
  isInsideBoundary: true,
  isAtZoneCentre: true,
  currentPosition: mockPosition,
  gpsAccuracy: 3,
  hasWeakSignal: false,
  hasReliableFix: true,
  isMockedLocation: false,
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: jest.fn() }),
  useRoute: () => ({ params: { landId: 'land-1' } }),
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const Map = ReactModule.forwardRef((props: object, _ref: unknown) => (
    <View {...props} />
  ));
  return {
    __esModule: true,
    default: Map,
    Circle: 'Circle',
    Marker: 'Marker',
    Polygon: 'Polygon',
    Polyline: 'Polyline',
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('../../utils/demoMode', () => ({ IS_AUDIT_DEMO_MODE: true }));
jest.mock('../../../../common/hooks/useGeofence', () => ({
  useGeofence: () => mockGeofence,
}));
jest.mock('../../../../common/utils/location', () => ({
  GPS_RELIABLE_ACCURACY_METRES: 10,
}));
jest.mock('../../../../common/utils/permissions', () => ({
  ensureLocationPermission: jest.fn(),
}));
jest.mock('../../../../store/hooks', () => ({
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({
      land: { parcels: [] },
      audit: {
        zones: [
          {
            zone_id: 'zone-1',
            centre_gps: { lat: 18.52, lng: 73.85 },
            radius_metres: 7,
          },
        ],
        currentZoneIndex: 0,
        scannedTrees: [],
        minTreesRequired: 3,
      },
    }),
}));

it('lets the map expand above a bounded bottom control panel and starts the correct zone', () => {
  const screen = render(<ZoneNavigationScreen />);
  const map = screen.getByTestId('zone-map');
  const controls = screen.getByTestId('zone-controls');
  expect(StyleSheet.flatten(map.props.style).flex).toBe(1);
  expect(StyleSheet.flatten(map.props.style).height).toBeUndefined();
  expect(controls.findAll(node => node === map)).toHaveLength(0);
  expect(StyleSheet.flatten(controls.props.style).flexGrow).toBe(0);
  expect(StyleSheet.flatten(controls.props.style).maxHeight).toBeGreaterThan(0);
  fireEvent.press(screen.getByText("You're here — Start Scanning"));
  expect(mockNavigate).toHaveBeenCalledWith('ARCameraScreen', {
    zoneId: 'zone-1',
    zoneIndex: 0,
  });
});
