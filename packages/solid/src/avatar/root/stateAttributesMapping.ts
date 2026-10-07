import { EMPTY_STATE_MAPPING } from "#utils/empty";

import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { AvatarRootState } from "./AvatarRoot";

export const avatarStateAttributesMapping: StateAttributesMapping<AvatarRootState> = {
  imageLoadingStatus: EMPTY_STATE_MAPPING,
};
