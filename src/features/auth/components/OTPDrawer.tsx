import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialDesignIcons as Icon } from '@react-native-vector-icons/material-design-icons';
import { useTheme } from '../../../common/theme/theme';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import Button from '../../../common/components/Button';
import { bootstrapAuthenticatedProfile } from '../../../services/authBootstrap';
import {
  confirmPhoneOtp,
  getCurrentFirebaseUser,
  observePhoneAuthentication,
  sendPhoneOtp,
  type AuthBootstrapResponse,
} from '../../../services/firebase';

interface Props {
  phone: string;
  verificationId: string | null;
  onClose: () => void;
  onVerified: (profile: AuthBootstrapResponse) => void;
}

const RESEND_SECONDS = 30;
const samePhone = (first?: string | null, second?: string) =>
  Boolean(first && first.replace(/\D/g, '') === second?.replace(/\D/g, ''));

/** A fresh component instance owns each phone attempt; closing discards its input and timers. */
export default function OTPDrawer({
  phone,
  verificationId,
  onClose,
  onVerified,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width, height, topInset, bottomInset, contentMaxWidth } =
    useResponsiveScreen();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const input = useRef<TextInput>(null);
  const active = useRef(true);
  const operation = useRef(false);
  const completed = useRef(false);
  const acceptedUid = useRef<string | null>(null);
  const activeId = useRef(verificationId);
  const resendAt = useRef(Date.now() + RESEND_SECONDS * 1000);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const verify = useCallback(
    async (value = '', automatic = false) => {
      if (!active.current || operation.current || completed.current) {
        return;
      }
      const existing = getCurrentFirebaseUser();
      const alreadyVerified = samePhone(existing?.phoneNumber, phone);
      if (!alreadyVerified && (automatic || value.length !== 6)) {
        return;
      }
      operation.current = true;
      setBusy(true);
      setError(null);
      let authenticated = alreadyVerified;
      try {
        if (!authenticated) {
          await confirmPhoneOtp(value, activeId.current);
          authenticated = samePhone(
            getCurrentFirebaseUser()?.phoneNumber,
            phone,
          );
        }
        if (!active.current) {
          return;
        }
        const user = getCurrentFirebaseUser();
        if (!authenticated || !user || !samePhone(user.phoneNumber, phone)) {
          throw new Error('AUTH_SESSION_CHANGED');
        }
        acceptedUid.current = user.uid;
        setVerified(true);
        const { profile } = await bootstrapAuthenticatedProfile();
        if (
          !active.current ||
          getCurrentFirebaseUser()?.uid !== acceptedUid.current ||
          profile.firebase_uid !== acceptedUid.current
        ) {
          return;
        }
        completed.current = true;
        Keyboard.dismiss();
        onVerifiedRef.current(profile);
      } catch (caught) {
        if (!active.current) {
          return;
        }
        const failure = caught as { code?: string; message?: string };
        // Firebase may auto-verify while a manually submitted code is rejected.
        if (
          !authenticated &&
          samePhone(getCurrentFirebaseUser()?.phoneNumber, phone)
        ) {
          acceptedUid.current = getCurrentFirebaseUser()!.uid;
          setVerified(true);
          setError('Phone verified. Tap Continue to finish sign-in.');
        } else if (authenticated) {
          setError(
            failure.message === 'APP_CONFIG_MISSING_API_BASE_URL'
              ? 'Server configuration is missing. Please install the latest app build.'
              : 'Phone verified. We could not load your account. Check your connection and tap Continue.',
          );
        } else {
          const message =
            failure.code === 'auth/invalid-verification-code'
              ? 'Incorrect code. Please try again.'
              : failure.code === 'auth/session-expired' ||
                failure.code === 'auth/invalid-verification-id' ||
                failure.message === 'OTP_SESSION_MISSING'
              ? 'This code expired. Please resend it.'
              : failure.code === 'auth/too-many-requests'
              ? 'Too many attempts. Wait a few minutes before trying again.'
              : failure.code === 'auth/network-request-failed'
              ? 'Check your connection and try again.'
              : 'Could not verify this code. Please try again.';
          setError(message);
          setCode('');
          input.current?.focus();
        }
      } finally {
        operation.current = false;
        if (active.current) {
          setBusy(false);
        }
      }
    },
    [phone],
  );

  useEffect(() => {
    active.current = true;
    const unsubscribe = observePhoneAuthentication(user => {
      if (samePhone(user?.phoneNumber, phone)) {
        void verify('', true);
      }
    });
    // Covers instant verification that happened before the drawer mounted.
    void verify('', true);
    const timer = setInterval(
      () =>
        setCountdown(
          Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => {
      active.current = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [phone, verify]);

  const resend = async () => {
    if (operation.current || completed.current || countdown > 0 || verified) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setResending(true);
    setError(null);
    try {
      const session = await sendPhoneOtp(phone);
      if (!active.current) {
        return;
      }
      activeId.current = session.verificationId;
      setCode('');
      resendAt.current = Date.now() + RESEND_SECONDS * 1000;
      setCountdown(RESEND_SECONDS);
      input.current?.focus();
    } catch (caught) {
      if (active.current) {
        const failure = caught as { code?: string };
        setError(
          failure.code === 'auth/too-many-requests'
            ? 'Too many requests. Wait a few minutes before resending.'
            : failure.code === 'auth/network-request-failed'
            ? 'Could not resend the code. Check your connection and try again.'
            : failure.code === 'auth/quota-exceeded'
            ? 'SMS is temporarily unavailable. Please try again later.'
            : 'Could not resend the code. Please try again.',
        );
      }
    } finally {
      operation.current = false;
      if (active.current) {
        setBusy(false);
        setResending(false);
        void verify('', true);
      }
    }
  };

  const close = () => {
    if (!completed.current) {
      active.current = false;
      Keyboard.dismiss();
      onClose();
    }
  };
  const available = Math.min(width - 48, contentMaxWidth - 48);
  const gap = width < 360 ? 6 : 8;
  const cellWidth = Math.floor((available - gap * 5) / 6);
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
      onShow={() => input.current?.focus()}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          testID="otp-backdrop"
          accessibilityLabel="Close verification"
          onPress={close}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        />
        <View
          testID="otp-drawer"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            maxHeight: height - topInset - 24,
            flexShrink: 1,
            backgroundColor: colors.CARD_WHITE,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderColor: colors.BORDER,
            borderWidth: 1,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 5,
              width: 40,
              borderRadius: 3,
              backgroundColor: colors.BORDER,
              alignSelf: 'center',
              marginTop: 12,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 24,
              paddingRight: 12,
              paddingTop: 8,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: colors.DARK_SLATE,
                fontSize: 23,
                fontWeight: '700',
              }}
            >
              Verify your number
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close verification drawer"
              onPress={close}
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" size={24} color={colors.DISABLED_GREY} />
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: Math.max(bottomInset + 20, 28),
            }}
          >
            <Text
              style={{
                color: colors.DISABLED_GREY,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              Enter the 6-digit code sent to{' '}
              {phone.replace(/(\+91)(\d{6})(\d{4})/, '$1 •••••• $3')}.
            </Text>
            <View
              style={{
                marginTop: 24,
                alignSelf: 'center',
                width: cellWidth * 6 + gap * 5,
                height: 58,
              }}
            >
              <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: 'row' }}
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <View
                    key={index}
                    style={{
                      width: cellWidth,
                      height: 58,
                      marginRight: index === 5 ? 0 : gap,
                      borderRadius: 14,
                      borderWidth:
                        index === Math.min(code.length, 5) && !verified ? 2 : 1,
                      borderColor:
                        error && !verified
                          ? colors.ERROR_RED
                          : index === Math.min(code.length, 5)
                          ? colors.FOREST_GREEN
                          : colors.BORDER,
                      backgroundColor: colors.INPUT_BACKGROUND,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: colors.DARK_SLATE,
                        fontSize: 24,
                        fontWeight: '700',
                      }}
                    >
                      {code[index] ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
              <TextInput
                ref={input}
                accessibilityLabel="Verification code"
                value={code}
                keyboardType="number-pad"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                textContentType="oneTimeCode"
                autoComplete={
                  Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'
                }
                importantForAutofill="yes"
                maxLength={6}
                caretHidden
                editable={!busy && !verified}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  color: 'transparent',
                  fontSize: 24,
                }}
                onChangeText={value => {
                  const next = value.replace(/\D/g, '').slice(0, 6);
                  setCode(next);
                  setError(null);
                  if (next.length === 6) {
                    void verify(next);
                  }
                }}
              />
            </View>
            <Text
              style={{
                color: colors.DISABLED_GREY,
                fontSize: 13,
                marginTop: 14,
              }}
            >
              The code is checked automatically when all six digits are entered.
            </Text>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={{
                  color: verified ? colors.DISABLED_GREY : colors.ERROR_RED,
                  marginTop: 16,
                  lineHeight: 22,
                }}
              >
                {error}
              </Text>
            ) : null}
            <Button
              style={{ marginTop: 24 }}
              label={
                resending
                  ? 'Resending...'
                  : busy
                  ? verified
                    ? 'Continuing...'
                    : 'Verifying...'
                  : verified
                  ? 'Continue'
                  : 'Verify OTP'
              }
              disabled={busy || (!verified && code.length !== 6)}
              onPress={() => {
                void verify(code);
              }}
            />
            <View
              style={{
                marginTop: 18,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {verified ? (
                <Text style={{ color: colors.FOREST_GREEN }}>
                  Phone number verified
                </Text>
              ) : countdown > 0 ? (
                <Text style={{ color: colors.DISABLED_GREY }}>
                  Resend in {countdown}s
                </Text>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    void resend();
                  }}
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ color: colors.FOREST_GREEN, fontWeight: '600' }}
                  >
                    Resend code
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {busy ? (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator size="small" color={colors.FOREST_GREEN} />
                <Text style={{ marginLeft: 8, color: colors.DISABLED_GREY }}>
                  Finishing verification securely
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={close}
                style={{
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.DISABLED_GREY }}>
                  Change phone number
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
