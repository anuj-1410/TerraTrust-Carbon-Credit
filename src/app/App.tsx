import '../../global.css';
import React, {useEffect} from 'react';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import BackgroundFetch from 'react-native-background-fetch';

import {store, persistor} from '../store';
import type {RootStackParamList} from '../types/navigation';
import Loader from '../common/components/Loader';

// Auth screens
import SplashScreen from '../features/auth/screens/SplashScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import OTPScreen from '../features/auth/screens/OTPScreen';
import KYCScreen from '../features/auth/screens/KYCScreen';

// Land screens
import LandListScreen from '../features/land/screens/LandListScreen';
import DocumentUploadScreen from '../features/land/screens/DocumentUploadScreen';
import BoundaryConfirmScreen from '../features/land/screens/BoundaryConfirmScreen';
import ManualUploadGuideScreen from '../features/land/screens/ManualUploadGuideScreen';

// AR-audit screens
import AuditStartScreen from '../features/ar-audit/screens/AuditStartScreen';
import ZoneNavigationScreen from '../features/ar-audit/screens/ZoneNavigationScreen';
import ARCameraScreen from '../features/ar-audit/screens/ARCameraScreen';
import ManualMeasureScreen from '../features/ar-audit/screens/ManualMeasureScreen';
import TreeResultScreen from '../features/ar-audit/screens/TreeResultScreen';
import AuditCompleteScreen from '../features/ar-audit/screens/AuditCompleteScreen';

// Dashboard screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import CreditHistoryScreen from '../features/dashboard/screens/CreditHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function configureBackgroundFetch() {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
    },
    async taskId => {
      // TODO: Process pending_upload queue from MMKV
      BackgroundFetch.finish(taskId);
    },
    async taskId => {
      // Timeout handler
      BackgroundFetch.finish(taskId);
    },
  );
}

const App = () => {
  useEffect(() => {
    configureBackgroundFetch();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="SplashScreen"
            screenOptions={{headerShown: false}}>
            {/* Auth */}
            <Stack.Screen name="SplashScreen" component={SplashScreen} />
            <Stack.Screen name="LoginScreen" component={LoginScreen} />
            <Stack.Screen name="OTPScreen" component={OTPScreen} />
            <Stack.Screen
              name="KYCScreen"
              component={KYCScreen}
              options={{gestureEnabled: false}}
            />

            {/* Land */}
            <Stack.Screen name="LandListScreen" component={LandListScreen} />
            <Stack.Screen
              name="DocumentUploadScreen"
              component={DocumentUploadScreen}
            />
            <Stack.Screen
              name="BoundaryConfirmScreen"
              component={BoundaryConfirmScreen}
            />
            <Stack.Screen
              name="ManualUploadGuideScreen"
              component={ManualUploadGuideScreen}
            />

            {/* AR-Audit */}
            <Stack.Screen
              name="AuditStartScreen"
              component={AuditStartScreen}
            />
            <Stack.Screen
              name="ZoneNavigationScreen"
              component={ZoneNavigationScreen}
            />
            <Stack.Screen name="ARCameraScreen" component={ARCameraScreen} />
            <Stack.Screen
              name="ManualMeasureScreen"
              component={ManualMeasureScreen}
            />
            <Stack.Screen
              name="TreeResultScreen"
              component={TreeResultScreen}
            />
            <Stack.Screen
              name="AuditCompleteScreen"
              component={AuditCompleteScreen}
            />

            {/* Dashboard */}
            <Stack.Screen
              name="HomeScreen"
              component={HomeScreen}
              options={{gestureEnabled: false}}
            />
            <Stack.Screen
              name="CreditHistoryScreen"
              component={CreditHistoryScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
};

export default App;
