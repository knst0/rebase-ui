import { useNavigate } from "@solidjs/router";
import { onSettled } from "solid-js";

import { preferredFramework } from "../framework";

export default function Index() {
  const navigate = useNavigate();
  onSettled(() => {
    navigate(`/${preferredFramework()}`, { replace: true });
  });
  return null;
}
