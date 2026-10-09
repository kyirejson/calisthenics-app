import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated and will be removed in a future release',
  'Cannot connect to Expo CLI',
]);

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
