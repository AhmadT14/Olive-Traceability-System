import { Routes, Route } from "react-router-dom";
import Home from "../features/public/Home";
import NotFound from "../features/public/NotFound";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
