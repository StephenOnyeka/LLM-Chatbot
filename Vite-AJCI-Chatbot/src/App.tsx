import { Navigate, Route, Routes } from "react-router-dom";
import ChatPage from "./routes/ChatPage";
import ChatThread from "./routes/ChatThread";
import DraftChat from "./routes/DraftChat";
import ForgotPasswordPage from "./routes/ForgotPasswordPage";
import LoginPage from "./routes/LoginPage";
import RegisterPage from "./routes/RegisterPage";
import RequireAuth from "./routes/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/chat" element={<ChatPage />}>
          <Route index element={<DraftChat />} />
          <Route path=":sessionId" element={<ChatThread />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
