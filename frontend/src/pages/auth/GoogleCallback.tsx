import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get("code");
    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    loginWithGoogleCode(code)
      .then(() => navigate("/", { replace: true }))
      .catch(() => navigate("/login", { replace: true }));
  }, [searchParams, loginWithGoogleCode, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Completing Google sign-in...
        </p>
      </div>
    </div>
  );
}
