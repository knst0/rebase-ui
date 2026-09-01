import { Title } from "@solidjs/meta";
import { Loading } from "solid-js";
import { PreloadSprite } from "znaki/solid";

import "./App.css";
import { Router } from "./router";

export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <PreloadSprite />
          <Title>Rebase UI</Title>
          <Loading>{props.children}</Loading>
        </>
      )}
    </Router>
  );
}
