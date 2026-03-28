/* @refresh reload */
import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";

import { Layout } from "./layout";
import { Home } from "./pages/Home";
import { Watch } from "./pages/Watch";

import "./index.css";

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/:handle" component={Watch} />
    </Router>
  ),
  document.getElementById("root")!,
);
