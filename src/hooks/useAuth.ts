import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const store = useAuthStore();
  return store;
};
