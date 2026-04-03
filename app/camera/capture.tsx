import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraScreen } from '../../src/components/camera/CameraScreen';

export default function CaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    guidanceText?: string;
    purpose?: string;
  }>();

  const handleCapture = (uri: string) => {
    const returnTo = params.returnTo || '/(tabs)/temperatures';
    router.replace({
      pathname: returnTo as never,
      params: { photoUri: uri, purpose: params.purpose },
    });
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <CameraScreen
      onCapture={handleCapture}
      onClose={handleClose}
      guidanceText={params.guidanceText || 'Prenez la photo'}
    />
  );
}
