/**
 * Monnify Service
 * Handles all interactions with the Monnify API for payment transfers
 */

// Monnify API Configuration
const MONNIFY_API_KEY = process.env.NEXT_PUBLIC_MONNIFY_API_KEY || '';
const MONNIFY_SECRET_KEY = process.env.NEXT_PUBLIC_MONNIFY_SECRET_KEY || '';
const MONNIFY_CONTRACT_CODE = process.env.NEXT_PUBLIC_MONNIFY_CONTRACT_CODE || '';
const MONNIFY_ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_MONNIFY_WALLET_ACCOUNT_NUMBER || '';
const MONNIFY_ACCOUNT_NAME = process.env.NEXT_PUBLIC_MONNIFY_ACCOUNT_NAME || '';
const MONNIFY_ACCOUNT_BVN = process.env.NEXT_PUBLIC_MONNIFY_ACCOUNT_BVN || '';
const MONNIFY_BANK_CODE = process.env.NEXT_PUBLIC_MONNIFY_BANK_CODE || '';
const MONNIFY_BASE_URL = process.env.NEXT_PUBLIC_MONNIFY_BASE_URL || 'https://sandbox.monnify.com';

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

interface MonnifyAuthResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: {
        accessToken: string;
        expiresIn: number;
    };
}

interface MonnifyTransferRequest {
    amount: number;
    reference: string;
    narration: string;
    destinationBankCode: string;
    destinationAccountNumber: string;
    currency: string;
    sourceAccountNumber: string;
    async?: boolean;
}

// Export the account details for use in other files
export { MONNIFY_ACCOUNT_NUMBER };

interface MonnifyTransferResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: {
        amount: number;
        reference: string;
        narration: string;
        destinationAccountNumber: string;
        destinationAccountName: string;
        destinationBankCode: string;
        destinationBankName: string;
        status: string;
        transactionReference: string;
        dateCreated: string;
    };
}

interface MonnifyTransferStatusResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: {
        amount: number;
        reference: string;
        status: string;
        transactionReference: string;
        destinationAccountNumber: string;
        destinationAccountName: string;
        destinationBankCode: string;
        destinationBankName: string;
        dateCreated: string;
    };
}

interface MonnifyWalletBalanceResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: {
        availableBalance: number;
        ledgerBalance: number;
    };
}

interface MonnifyAuthorizationResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: {
        amount: number;
        reference: string;
        status: string;
        transactionReference: string;
    };
}

interface MonnifyBank {
    name: string;
    code: string;
    ussdTemplate?: string;
    baseUssdCode?: string;
}

interface MonnifyBankListResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string;
    responseBody: MonnifyBank[];
}

/**
 * Get list of all banks from Monnify
 */
export async function getBankList(): Promise<MonnifyBank[]> {
    try {
        const token = await authenticateMonnify();

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/banks`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Get banks error response:', errorText);
            throw new Error(`Failed to get banks: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data: MonnifyBankListResponse = await response.json();

        if (!data.requestSuccessful) {
            console.error('Get banks failed:', data);
            throw new Error(`Failed to get banks: ${data.responseMessage}`);
        }

        return data.responseBody;
    } catch (error) {
        console.error('Error getting bank list:', error);
        throw new Error(`Failed to get bank list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Authenticate with Monnify API and get Bearer token
 * Tokens are cached for 60 minutes to reduce API calls
 */
export async function authenticateMonnify(): Promise<string> {
    // Check if we have a valid cached token
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        // Create Basic Auth credentials
        const credentials = `${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedCredentials}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
        }

        const data: MonnifyAuthResponse = await response.json();

        if (!data.requestSuccessful) {
            throw new Error(`Monnify authentication failed: ${data.responseMessage}`);
        }

        // Cache the token (expires in 60 minutes, we'll refresh at 55 minutes)
        cachedToken = data.responseBody.accessToken;
        tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

        return cachedToken;
    } catch (error) {
        console.error('Monnify authentication error:', error);
        throw new Error(`Failed to authenticate with Monnify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get Monnify wallet balance
 */
export async function getWalletBalance(): Promise<{ availableBalance: number; ledgerBalance: number }> {
    try {
        const token = await authenticateMonnify();

        // Monnify API v2 requires accountNumber parameter (wallet account number)
        if (!MONNIFY_ACCOUNT_NUMBER) {
            throw new Error('MONNIFY_ACCOUNT_NUMBER is not configured');
        }

        const url = `${MONNIFY_BASE_URL}/api/v2/disbursements/wallet-balance?accountNumber=${MONNIFY_ACCOUNT_NUMBER}`;

        console.log('Fetching wallet balance from:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Wallet balance error response:', errorText);
            throw new Error(`Failed to get wallet balance: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data: MonnifyWalletBalanceResponse = await response.json();

        if (!data.requestSuccessful) {
            console.error('Wallet balance failed:', data);
            throw new Error(`Failed to get wallet balance: ${data.responseMessage}`);
        }

        return {
            availableBalance: data.responseBody.availableBalance,
            ledgerBalance: data.responseBody.ledgerBalance,
        };
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        throw new Error(`Failed to get wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Initiate a single transfer to a bank account
 */
export async function initiateSingleTransfer(
    transferRequest: MonnifyTransferRequest
): Promise<MonnifyTransferResponse> {
    try {
        const token = await authenticateMonnify();

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transferRequest),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Transfer initiation failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data: MonnifyTransferResponse = await response.json();

        if (!data.requestSuccessful) {
            throw new Error(`Transfer failed: ${data.responseMessage}`);
        }

        return data;
    } catch (error) {
        console.error('Error initiating transfer:', error);
        throw new Error(`Failed to initiate transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Authorize a transfer (for accounts with 2FA enabled)
 */
export async function authorizeSingleTransfer(
    reference: string,
    authorizationCode: string
): Promise<MonnifyAuthorizationResponse> {
    try {
        const token = await authenticateMonnify();

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single/validate-otp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reference,
                authorizationCode,
            }),
        });

        const data: MonnifyAuthorizationResponse = await response.json();

        return data;
    } catch (error) {
        console.error('Error authorizing transfer:', error);
        throw new Error(`Failed to authorize transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Resend OTP for transfer authorization
 */
export async function resendOTP(reference: string): Promise<{ requestSuccessful: boolean,responseCode: string; responseMessage: string }> {
    try {
        const token = await authenticateMonnify();

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single/resend-otp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference }),
        });

        const data = await response.json();
        console.log("Resend OTP response:", data)
        return data;
    } catch (error) {
        console.error('Error resending OTP:', error);
        throw new Error(`Failed to resend OTP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get the status of a single transfer
 */
export async function getSingleTransferStatus(reference: string): Promise<MonnifyTransferStatusResponse> {
    try {
        const token = await authenticateMonnify();

        const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single/summary?reference=${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get transfer status: ${response.status} ${response.statusText}`);
        }

        const data: MonnifyTransferStatusResponse = await response.json();

        if (!data.requestSuccessful) {
            throw new Error(`Failed to get transfer status: ${data.responseMessage}`);
        }

        return data;
    } catch (error) {
        console.error('Error getting transfer status:', error);
        throw new Error(`Failed to get transfer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Helper function to format Monnify error messages
 */
export function formatMonnifyError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

/**
 * Helper function to check if transfer is in final state
 */
export function isTransferFinal(status: string): boolean {
    const finalStatuses = ['SUCCESS', 'FAILED', 'REVERSED'];
    return finalStatuses.includes(status.toUpperCase());
}

/**
 * Helper function to check if transfer was successful
 */
export function isTransferSuccessful(status: string): boolean {
    return status.toUpperCase() === 'SUCCESS';
}
