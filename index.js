/**
 * @format
 */

import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './src/app/App';
import { name as appName } from './app.json';
import { retryPendingAuditUpload } from './src/services/api';

// Register HeadlessTask for background-fetch retry of pending audit uploads
BackgroundFetch.registerHeadlessTask(async event => {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }

  await retryPendingAuditUpload();

  BackgroundFetch.finish(event.taskId);
});

AppRegistry.registerComponent(appName, () => App);
