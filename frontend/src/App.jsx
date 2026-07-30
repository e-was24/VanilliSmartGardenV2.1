import { useState } from "react";
import { Routes, Route } from "react-router";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Garden from "./pages/Garden";
import Data from "./pages/Data";
import PlantControls from "./pages/PlantControls";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="apps">
      <div className="nav-cover" style={{ position: "fixed", width: "100%", zIndex: "999" }}>
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
            isAuthenticated ? <PlantControls /> : <Home />
          }
        />
        <Route path="/garden" element={<Garden />} />
        <Route path="/data" element={<Data />} />
      </Routes>
    </div>
  );
}

export default App;
