import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { AvatarRootState } from "./AvatarRoot";
import { EMPTY_STATE_MAPPING } from "#utils/empty";

export const avatarStateAttributesMapping: StateAttributesMapping<AvatarRootState> = {
  imageLoadingStatus: EMPTY_STATE_MAPPING,
};
