// Network identity comes from @nyxels/lib (shared with the integration
// tests); this module re-exports it so app code keeps a single import site,
// and adds the UI's own policy: which network the app starts on.
export { Network, NETWORKS, type NetworkId } from "@nyxels/lib";
import { Network } from "@nyxels/lib";

export const DEFAULT_NETWORK: Network = Network.Mainnet;
