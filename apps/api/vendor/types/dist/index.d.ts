export interface User {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    onboardingComplete: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ApiKeyStatus {
    hasKey: boolean;
    provider: string;
    keyPreview?: string;
    verifiedAt?: string;
}
export interface Matter {
    id: string;
    userId: string;
    name: string;
    type: string;
    status: string;
    court?: string;
    attorney?: string;
    value?: number;
    currency: string;
    dueDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    contracts?: Contract[];
    timeEntries?: TimeEntry[];
}
export interface Contract {
    id: string;
    userId: string;
    matterId?: string;
    filename: string;
    storageUrl: string;
    fileSize?: number;
    detectedType?: string;
    detectedGoverningLaw?: string;
    detectedParties?: Record<string, string>;
    analysisJson?: ContractAnalysis;
    riskScore?: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export interface ContractAnalysis {
    summary: string;
    governingLaw: string;
    contractType: string;
    parties: Record<string, string>;
    flags: ContractFlag[];
    missingSections: string[];
    executiveSummary: string;
    riskScore: number;
    citations: LegalCitation[];
}
export interface ContractFlag {
    id: string;
    severity: 'critical' | 'high' | 'med' | 'low';
    title: string;
    body: string;
    suggestion?: string;
    citation?: string;
}
export interface LegalCitation {
    type: string;
    label: string;
    title: string;
    citation: string;
    excerpt: string;
    confidence: number;
    status: string;
    jurisdiction: string;
}
export interface ResearchResult {
    verifiedResults: LegalCitation[];
    aiAnalysis: string;
    jurisdiction?: string;
    sessionId: string;
}
export interface AgentChatInput {
    agentId: string;
    message: string;
    history: Message[];
    systemPrompt?: string;
    edition?: string;
    jurisdiction?: string;
}
export interface Message {
    role: 'user' | 'assistant';
    content: string;
}
export interface AgentSession {
    id: string;
    userId: string;
    agentId: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
}
export interface TimeEntry {
    id: string;
    userId: string;
    matterId?: string;
    description: string;
    hours: number;
    rate?: number;
    currency: string;
    date: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export interface GeneratedDocument {
    id: string;
    userId: string;
    storagePath: string;
    filename: string;
    documentType?: string;
    documentJson?: DraftedDocument;
    expiresAt: string;
    signedUrl?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DraftedDocument {
    type: string;
    title: string;
    parties: Record<string, string>;
    clauses: DocumentClause[];
    metadata: Record<string, string>;
}
export interface DocumentClause {
    heading: string;
    content: string;
    placeholders?: string[];
}
