import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { encryptString, decryptString, Algorithm } from './functions';

const DEFAULT_SECRET_KEY = 'FOmd23PkX0QxHJc7S59sEjg6FmaRmCef';
const DEFAULT_ALGORITHM = 'aes-256-gcm';

export class TextEncryptor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Text Encryptor',
		name: 'textEncryptor',
		icon: { light: 'file:icon.light.svg', dark: 'file:icon.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Simple text encrypt and decrypt',
		subtitle: '={{$parameter["operation"]}}',
		defaults: {
			name: 'Text Encryptor',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				description: 'Choose whether to encrypt or decrypt the text',
				required: true,
				options: [
					{
						name: 'Encrypt',
						value: 'encrypt',
						description: 'Encrypt the provided text',
						action: 'Encrypt text',
					},
					{
						name: 'Decrypt',
						value: 'decrypt',
						description: 'Decrypt the provided text',
						action: 'Decrypt text',
					}
				],
				default: 'encrypt',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				requiresDataPath: 'single',
				default: '',
				placeholder: 'Enter text here',
				description: 'The text to process',
				required: true,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add options',
				default: {},
				options: [
					{
						displayName: 'Secret Key',
						name: 'secretKey',
						type: 'string',
						requiresDataPath: 'single',
						default: '',
						typeOptions: {
							password: true
						},
						description: 'The secret key used for encryption/decryption. Must be the same for both operations. Leave empty to use default key',
					},
					{
						displayName: 'Algorithm',
						name: 'algorithm',
						type: 'options',
						options: [
							{
								name: 'AES-256-GCM',
								value: 'aes-256-gcm',
								description: 'AES with a 256-bit key in Galois/Counter Mode (GCM)',
							},
							{
								name: 'AES-256-CBC',
								value: 'aes-256-cbc',
								description: 'AES with a 256-bit key in Cipher Block Chaining (CBC) mode',
							},
						],
						default: 'aes-256-gcm',
						description: 'The encryption algorithm to use. Must be the same for both encrypt and decrypt operations.',
					}
				]
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let text: string;
		let secretKey: string;
		let algorithm: Algorithm;

		const returnItems: INodeExecutionData[] = [];
		const options = this.getNodeParameter('options', 0) as { secretKey?: string, algorithm?: string };
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				text = this.getNodeParameter('text', itemIndex, '') as string;
				secretKey = options.secretKey || DEFAULT_SECRET_KEY;
				algorithm = options.algorithm as Algorithm || DEFAULT_ALGORITHM;
				item = items[itemIndex];

				const result = operation === 'encrypt' ? encryptString(text, secretKey, algorithm) : decryptString(text, secretKey, algorithm);

				item.json = {
					original: text,
					operation,
					result,
				}
				returnItems.push(item);
			} catch (error) {
				// Enhance error messages for common issues
				if (operation === 'decrypt') {
					if (error.code === 'ERR_OSSL_BAD_DECRYPT'
						|| error.code === 'ERR_CRYPTO_INVALID_IV'
						|| error.message.includes('Unsupported state or unable to authenticate data')
						|| error.message.includes('Invalid authentication tag length')) {
						error.message = 'Decryption failed. Incorrect secret key or corrupted/invalid encrypted text';
					}
				}

				if (this.continueOnFail()) {
					returnItems.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				// Adding `itemIndex` allows other workflows to handle this error
				if (error.context) {
					// If the error thrown already contains the context property,
					// only append the itemIndex
					error.context.itemIndex = itemIndex;
					throw error;
				}

				throw new NodeOperationError(this.getNode(), error, {
					itemIndex,
				});
			}
		}

		return [returnItems];
	}
}
