import { Navigate, Route, Routes } from "react-router-dom";
import ChatPage from "./routes/ChatPage";
import ChatThread from "./routes/ChatThread";
import DraftChat from "./routes/DraftChat";
import ForgotPasswordPage from "./routes/ForgotPasswordPage";
import GoogleVerifyPage from "./routes/GoogleVerifyPage";
import LoginPage from "./routes/LoginPage";
import RegisterPage from "./routes/RegisterPage";
import RequireAuth from "./routes/RequireAuth";
import { AlertModal } from "./components/ui/AlertModal";
import { useUIStore } from "./store/uiStore";

export default function App() {
  const alertConfig = useUIStore((s) => s.alertConfig);
  const closeAlert = useUIStore((s) => s.closeAlert);

  return (
    <>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/google-verify" element={<GoogleVerifyPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/chat" element={<ChatPage />}>
          <Route index element={<DraftChat />} />
          <Route path=":sessionId" element={<ChatThread />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
    {alertConfig && (
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
      />
    )}
    </>
  );
}
