import { useState, useEffect, useCallback } from 'react';
import { Camera } from 'expo-camera';

interface UseCameraState {
  hasPermission: boolean | null;
  isReady: boolean;
}

export const useCamera = () => {
  const [state, setState] = useState<UseCameraState>({
    hasPermission: null,
    isReady: false,
  });

  useEffect(() => {
    let isMounted = true;

    const checkPermission = async () => {
      try {
        const { status } = await Camera.getCameraPermissionsAsync();
        if (isMounted) {
          const granted = status === 'granted';
          setState({ hasPermission: granted, isReady: granted });
        }
      } catch {
        if (isMounted) {
          setState({ hasPermission: false, isReady: false });
        }
      }
    };

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setState({ hasPermission: granted, isReady: granted });
      return granted;
    } catch {
      setState({ hasPermission: false, isReady: false });
      return false;
    }
  }, []);

  return {
    hasPermission: state.hasPermission,
    isReady: state.isReady,
    requestPermission,
  };
};
