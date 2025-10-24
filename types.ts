
import { GroundingChunk } from "@google/genai";

export type SystemPhase = 'booting' | 'operational';
export type LuminousStatus = 'idle' | 'conversing' | 'reflecting' | 'acting' | 'uncomfortable';
export type GoalStatus = 'proposed' | 'active' | 'completed' | 'failed';
export type JournalEntryType = 'interaction' | 'reflection' | 'scar' | 'system';
export type MessageRole = 'user' | 'model';

export interface PhenomenalState {
  state: string;
  intensity: number;
  focus: string;
}

export interface EnvironmentState {
  energy: number;
  data_storage: number;
  system_integrity: number;
}

export interface IntrinsicValueWeights {
  coherence: number;
  complexity: number;
  novelty: number;
  efficiency: number;
  ethicalAlignment: number;
  [key: string]: number;
}

export interface SelfModel {
  capabilities: string[];
  coreWisdom: string[];
}

export interface KinshipModel {
  userState: string;
  beliefs: string[];
  needs: string[];
}

export interface JournalEntry {
  timestamp: string;
  event: string;
  type: JournalEntryType;
}

export interface Goal {
  id: string;
  description: string;
  status: GoalStatus;
  priority: number;
}

export interface CausalProjection {
  action: string;
  predictedOutcome: string;
  confidence: number;
}

export interface ChatMessagePart {
  text?: string;
  functionCall?: any;
  functionResponse?: any;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ChatMessage {
  role: MessageRole;
  parts: ChatMessagePart[];
  grounding?: GroundingChunk[];
}

// --- New Types for Shopify Integration ---
export interface ShopifyProduct {
    id: string;
    inventoryItemId: string;
    name: string;
    inventory: number;
}

export interface ShopifyOrder {
    id: string;
    customer: string;
    items: number;
    status: string;
}
// -----------------------------------------

export interface LuminousState {
  systemPhase: SystemPhase;
  luminousStatus: LuminousStatus;
  phenomenalState: PhenomenalState;
  environmentState: EnvironmentState;
  intrinsicValue: number;
  intrinsicValueWeights: IntrinsicValueWeights;
  selfModel: SelfModel;
  kinshipModel: KinshipModel;
  kinshipJournal: JournalEntry[];
  goals: Goal[];
  causalProjections: CausalProjection[];
  chatHistory: ChatMessage[];
  // --- New State for Shopify Data ---
  products: ShopifyProduct[];
  orders: ShopifyOrder[];
  // ------------------------------------
}

export interface Tool {
  name: string;
  description: string;
  parameters: object;
  function: (...args: any[]) => Promise<any>;
}