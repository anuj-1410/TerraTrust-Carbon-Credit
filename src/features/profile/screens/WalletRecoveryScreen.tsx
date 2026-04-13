import React, {useEffect, useMemo, useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {
  confirmPhoneOtp,
  sendPhoneOtp,
} from '../../../services/firebase';
import {createFarmerWallet} from '../../../services/wallet';
import api from '../../../services/api';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {setWalletRecoveryState} from '../store/profileSlice';
import {addNotification} from '../../notifications/store/notificationsSlice';
import type {ProfileStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<
  ProfileStackParamList,
  'WalletRecoveryScreen'
>;

type RecoveryStep = 'intro' | 'verify' | 'success';

const WalletRecoveryScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const phone = useAppSelector(state => state.auth.user?.phone ?? '');
  const notificationsEnabled = useAppSelector(
    state => state.profile.settingsNotificationsEnabled,
  );
  const walletRecoveryStatus = useAppSelector(
    state => state.profile.walletRecoveryStatus,
  );
  const walletRecoveryRequestedAt = useAppSelector(
    state => state.profile.walletRecoveryRequestedAt,
  );
  const [step, setStep] = useState<RecoveryStep>('intro');
  const [otpCode, setOtpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isRecoveryPending = walletRecoveryStatus === 'PENDING';

  const maskedPhone = useMemo(
    () => phone.replace(/(\+91)(\d{6})(\d{4})/, '$1 XXXXXX$3'),
    [phone],
  );
  const submittedLabel = useMemo(() => {
    if (!walletRecoveryRequestedAt) {
      return null;
    }

    const requestedAt = new Date(walletRecoveryRequestedAt);
    if (Number.isNaN(requestedAt.getTime())) {
      return null;
    }

    return requestedAt.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [walletRecoveryRequestedAt]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    const timer = setTimeout(() => {
      navigation.goBack();
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigation, step]);

  const startRecovery = async () => {
    try {
      setIsBusy(true);
      setErrorMessage(null);
      await sendPhoneOtp(phone);
      setStep('verify');
    } catch {
      setErrorMessage('Unable to send OTP. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const submitRecovery = async () => {
    if (otpCode.trim().length !== 6) {
      setErrorMessage('Enter the 6-digit OTP sent to your phone.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage(null);

      await confirmPhoneOtp(otpCode.trim());
      const newWalletAddress = await createFarmerWallet();

      await api.post('/api/v1/auth/recover-wallet', {
        new_wallet_address: newWalletAddress,
      });

      dispatch(
        setWalletRecoveryState({
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
        }),
      );

      if (notificationsEnabled) {
        dispatch(
          addNotification({
            id: 'wallet-recovery-pending',
            type: 'wallet_recovery',
            title: 'Wallet recovery submitted',
            body: 'TerraTrust received your wallet recovery request.',
            createdAt: new Date().toISOString(),
            read: false,
          }),
        );
      }

      setStep('success');
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.error ?? 'Wallet recovery failed. Please try again.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View className="flex-1 px-4 pt-12" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <View className="flex-row items-center">
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            color={COLORS.DARK_SLATE}
            name="arrow-left"
            size={24}
          />
        </TouchableOpacity>
        <Text className="ml-3 text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Wallet Recovery
        </Text>
      </View>

      <Card className="mt-5" style={{backgroundColor: 'rgba(221,107,32,0.12)'}}>
        <Text className="font-semibold" style={{color: COLORS.WARNING_ORANGE}}>
          Only use this if you have a new phone and your old wallet no longer works.
        </Text>
        <Text className="mt-2 leading-6" style={{color: COLORS.DARK_SLATE}}>
          Future TerraTrust credits move to the new wallet only after approval.
        </Text>
        <Text className="mt-2 leading-6" style={{color: COLORS.DARK_SLATE}}>
          Already-issued on-chain tokens stay at the original wallet in v3.1.
        </Text>
      </Card>

      {isRecoveryPending ? (
        <Card className="mt-4 gap-2">
          <Text className="text-sm font-semibold uppercase" style={{color: COLORS.WARNING_ORANGE}}>
            Pending Review
          </Text>
          <Text style={{color: COLORS.DARK_SLATE}}>
            TerraTrust has already received a wallet recovery request for this account.
          </Text>
          {submittedLabel ? (
            <Text style={{color: COLORS.DISABLED_GREY}}>
              Submitted on {submittedLabel}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card className="mt-4 gap-4">
        <Text style={{color: COLORS.DARK_SLATE}}>1. We will verify your identity again with a new OTP.</Text>
        <Text style={{color: COLORS.DARK_SLATE}}>2. A new wallet will be created on this phone.</Text>
        <Text style={{color: COLORS.DARK_SLATE}}>
          3. After approval, future TerraTrust credits will go to the new wallet.
        </Text>
      </Card>

      {step === 'verify' ? (
        <Card className="mt-4 gap-4">
          <Text style={{color: COLORS.DARK_SLATE}}>
            Enter the 6-digit code sent to {maskedPhone}
          </Text>
          <TextInput
            className="rounded-xl border bg-white px-4 py-4 text-center text-xl"
            style={{borderColor: COLORS.DISABLED_GREY, color: COLORS.DARK_SLATE}}
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={text => setOtpCode(text.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor={COLORS.DISABLED_GREY}
          />
          <Button label={isBusy ? 'Submitting...' : 'Verify & Submit Recovery'} onPress={submitRecovery} disabled={isBusy} />
        </Card>
      ) : null}

      {step === 'success' ? (
        <Card className="mt-4 gap-3">
          <Text className="text-lg font-bold" style={{color: COLORS.FOREST_GREEN}}>
            Recovery request submitted
          </Text>
          <Text style={{color: COLORS.DARK_SLATE}}>
            Our team will process this within 24 hours and notify you.
          </Text>
          <Button label="Back to Profile" onPress={() => navigation.goBack()} />
        </Card>
      ) : null}

      {errorMessage ? (
        <Text className="mt-4" style={{color: COLORS.ERROR_RED}}>
          {errorMessage}
        </Text>
      ) : null}

      {step === 'intro' ? (
        <View className="mt-8">
          <Button
            label={
              isRecoveryPending
                ? 'Recovery Request Pending'
                : isBusy
                  ? 'Sending OTP...'
                  : 'Start Recovery Process'
            }
            onPress={startRecovery}
            disabled={isBusy || !phone || isRecoveryPending}
          />
        </View>
      ) : null}
    </View>
  );
};

export default WalletRecoveryScreen;