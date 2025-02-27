import { BrowserRouter, Route, Routes } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import UploadPage from "./pages/UploadPage";
import QPPreviewPage from "./pages/QPPreviewPage";
import OAuthPage from "./pages/OAuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import { AuthProvider } from "./utils/auth";
import { Footer } from "./components/Common/Common";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={<SearchPage />}
            />
            <Route
              path="/upload"
              element={<UploadPage />}
            />
            <Route
              path="/qp/:id"
              element={<QPPreviewPage />}
            />
            <Route
              path="/oauth"
              element={<OAuthPage />}
            />
            <Route
              path="/admin"
              element={<AdminDashboard />}
            />
          </Routes>
        </AuthProvider>
        <Footer />
        <Toaster
          toastOptions={{
            position: 'bottom-center',
            className: 'toast'
          }}
        />
      </BrowserRouter>
    </>
  )
}

export default App;
