import { useState } from "react";
import { Routes, Route, Navigate } from "react-router";
import Navbar from "./components/navbar";
import Home from "./pages/Home";
import Garden from "./pages/garden";
import Data from "./pages/data";
import PlantControls from "./pages/PlantControls";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="apps">
      <div className="nav-cover" style={{position: "fixed", width: "100%", zIndex: "999"}}>
        <Navbar
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
        />
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/plant"
          element={
            isAuthenticated ? <PlantControls /> : <Navigate to="/" replace />
          }
        />
        <Route path="/garden" element={<Garden />} />
        <Route path="/data" element={<Data />} />
      </Routes>
    </div>
  );
}

export default App;
