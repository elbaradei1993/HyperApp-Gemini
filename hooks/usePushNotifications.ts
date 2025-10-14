import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

// IMPORTANT: Replace this with your own VAPID public key.
// You can generate VAPID keys using a library like `web-push`.
// The private key should be stored securely as a Supabase Edge Function secret.
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushManager = (userId?: string) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          setSubscription(sub);
          setIsSubscribed(!!sub);
        } catch (e) {
            console.error("Error checking for push subscription", e);
        }
      }
      setLoading(false);
    };
    checkSubscription();
  }, []);

  const subscribe = async (): Promise<boolean> => {
    if (!userId) { 
        setError('User not logged in.');
        return false;
    }
    if (isSubscribed) return true;
    
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permission not granted.');
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { error: dbError } = await supabase.from('push_subscriptions').insert({ user_id: userId, subscription_object: sub.toJSON() });
      if (dbError) throw dbError;

      setSubscription(sub);
      setIsSubscribed(true);
      return true;
    } catch (e: any) {
      setError(`Subscription failed: ${e.message}`);
      console.error(e);
      // Clean up if subscription was created but DB insert failed
      const currentSub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if(currentSub) await currentSub.unsubscribe();
      setIsSubscribed(false);
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    const subToDelete = subscription || await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!subToDelete) {
        setError('Not subscribed.');
        return false;
    }
    
    setError(null);
    try {
      const { error: dbError } = await supabase.from('push_subscriptions').delete().eq('subscription_object->>endpoint', subToDelete.endpoint);
      if (dbError) throw dbError;

      await subToDelete.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (e: any) {
      setError(`Unsubscription failed: ${e.message}`);
      console.error(e);
      return false;
    }
  };

  return { isSubscribed, loading, subscribe, unsubscribe, error };
};
