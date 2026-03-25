/**
 * @format
 */

import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './src/app/App';
import { name as appName } from './app.json';
import { retryPendingUpload } from './src/services/pendingUploadService';

// Register HeadlessTask for background-fetch retry of pending uploads
BackgroundFetch.registerHeadlessTask(async event => {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }
  await retryPendingUpload(event.taskId);
  BackgroundFetch.finish(event.taskId);
});

AppRegistry.registerComponent(appName, () => App);
