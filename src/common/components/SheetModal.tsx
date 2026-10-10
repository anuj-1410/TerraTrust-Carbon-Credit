import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  visible: boolean;
  onRequestClose: () => void;
  onOpened?: () => void;
  onDismissed?: () => void;
  children: React.ReactNode;
}

/** One native-driven timeline moves the sheet and fades the stationary backdrop. */
export default function SheetModal({
  visible,
  onRequestClose,
  onOpened,
  onDismissed,
  children,
}: Props) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const progress = useRef(new Animated.Value(0)).current;
  const distance = useRef(new Animated.Value(height)).current;
  const shown = useRef(false);
  const callbacks = useRef({ onOpened, onDismissed });
  callbacks.current = { onOpened, onDismissed };
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const transition = useCallback(
    (opening: boolean) => {
      animation.current?.stop();
      animation.current = Animated.timing(progress, {
        toValue: opening ? 1 : 0,
        duration: reduced ? 0 : opening ? 280 : 200,
        easing: opening ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.current.start(({ finished }) => {
        if (!finished || opening !== visibleRef.current) {
          return;
        }
        if (opening) {
          callbacks.current.onOpened?.();
        } else {
          shown.current = false;
          mountedRef.current = false;
          setMounted(false);
          callbacks.current.onDismissed?.();
        }
      });
    },
    [progress, reduced],
  );

  useEffect(() => {
    if (!visible && mounted) {
      Keyboard.dismiss();
    }
    if (visible) {
      setMounted(true);
    }
    if (shown.current || (!visible && mounted)) {
      transition(visible);
    }
  }, [visible, mounted, transition]);
  useEffect(() => () => animation.current?.stop(), []);

  if (!mounted) {
    return null;
  }
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
      onShow={() => {
        if (!mountedRef.current) {
          return;
        }
        shown.current = true;
        transition(visibleRef.current);
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress },
          ]}
        />
        <Pressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Close drawer"
          disabled={!visible}
          onPress={onRequestClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          onLayout={event => distance.setValue(event.nativeEvent.layout.height)}
          style={{
            width: '100%',
            maxHeight: '100%',
            flexShrink: 1,
            transform: [
              {
                translateY: Animated.multiply(
                  Animated.subtract(1, progress),
                  distance,
                ),
              },
            ],
          }}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
