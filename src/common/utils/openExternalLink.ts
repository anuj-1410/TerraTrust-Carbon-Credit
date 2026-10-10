import { Alert, Linking } from 'react-native';

export async function openExternalLink(url: string): Promise<void> {
  try {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('LINK_UNSUPPORTED');
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Could not open link',
      'Please check your connection and try again.',
    );
  }
}
