import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRealtimeStatus } from '@/sync/storage';

const VOICE_NOTIFICATION_ID = 'voice-active';

/**
 * Keeps the voice session alive when the app is backgrounded on Android.
 *
 * Shows a persistent notification while voice is active, which signals to Android
 * that the app is doing foreground work and should not be suspended.
 *
 * Also logs when voice disconnects while backgrounded for debugging.
 */
export function useVoiceBackground() {
    const realtimeStatus = useRealtimeStatus();
    const wasConnectedRef = useRef(false);

    useEffect(() => {
        const isConnected = realtimeStatus === 'connected';

        if (isConnected && !wasConnectedRef.current) {
            // Voice just connected — show persistent notification
            wasConnectedRef.current = true;
            if (Platform.OS !== 'web') {
                void showVoiceNotification();
            }
        } else if (!isConnected && wasConnectedRef.current) {
            // Voice disconnected — dismiss notification
            wasConnectedRef.current = false;
            if (Platform.OS !== 'web') {
                void dismissVoiceNotification();
            }
        }

        return () => {
            if (wasConnectedRef.current) {
                wasConnectedRef.current = false;
                if (Platform.OS !== 'web') {
                    void dismissVoiceNotification();
                }
            }
        };
    }, [realtimeStatus]);

    // Log when voice drops while backgrounded (for debugging)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && wasConnectedRef.current && realtimeStatus === 'disconnected') {
                console.warn('[VoiceBackground] Voice disconnected while app was in background');
            }
        });
        return () => subscription.remove();
    }, [realtimeStatus]);
}

async function showVoiceNotification() {
    try {
        await Notifications.scheduleNotificationAsync({
            identifier: VOICE_NOTIFICATION_ID,
            content: {
                title: 'Voice Assistant Active',
                body: 'Tap to return to Happy',
                sticky: true,
                ...(Platform.OS === 'android' ? { channelId: 'voice' } : {}),
            },
            trigger: null,
        });
    } catch (error) {
        console.warn('[VoiceBackground] Failed to show voice notification:', error);
    }
}

async function dismissVoiceNotification() {
    try {
        await Notifications.dismissNotificationAsync(VOICE_NOTIFICATION_ID);
    } catch (error) {
        console.warn('[VoiceBackground] Failed to dismiss voice notification:', error);
    }
}
