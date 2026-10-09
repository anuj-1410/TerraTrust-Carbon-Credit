import React, { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Button from '../common/components/Button';
import { useTheme } from '../common/theme/theme';
import type { ThemeColors } from '../common/constants/colors';

/** Keep rendering failures recoverable without deleting the signed-in session. */
class RenderBoundary extends Component<
  { children: ReactNode; colors: ThemeColors },
  { failed: boolean; revision: number }
> {
  state = { failed: false, revision: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    const COLORS = this.props.colors;
    if (this.state.failed) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: COLORS.OFF_WHITE,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '600',
              color: COLORS.DARK_SLATE,
            }}
          >
            Unable to display this screen
          </Text>
          <Text style={{ marginVertical: 20, color: COLORS.DARK_SLATE }}>
            Retry to reopen the app. Your saved sign-in and data will be kept.
          </Text>
          <Button
            label="Retry"
            onPress={() =>
              this.setState(({ revision }) => ({
                failed: false,
                revision: revision + 1,
              }))
            }
          />
        </View>
      );
    }
    return (
      <React.Fragment key={this.state.revision}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default function AppErrorBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return <RenderBoundary colors={colors}>{children}</RenderBoundary>;
}
