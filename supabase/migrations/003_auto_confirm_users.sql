-- Auto-confirme chaque nouvel utilisateur côté Postgres pour que le flow
-- d'inscription renvoie immédiatement une session utilisable (pas
-- d'aller-retour email de confirmation). Équivalent au toggle
-- "Mailer Autoconfirm" du dashboard Supabase, mais en code pour qu'un
-- redeploy / réplica garde le même comportement.
--
-- Pour une mise en prod stricte : drop ce trigger et ré-activer la
-- confirmation d'email dans Auth → Settings.

CREATE OR REPLACE FUNCTION public.handle_new_user_autoconfirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_user_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_autoconfirm();

-- La fonction a besoin de SECURITY DEFINER pour muter auth.users, mais
-- l'exposer comme RPC n'a aucun intérêt et déclenche le linter
-- Supabase. On révoque EXECUTE des rôles publics ; le trigger continue
-- de fonctionner car il s'exécute en tant que owner.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_autoconfirm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_autoconfirm() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_autoconfirm() FROM authenticated;
