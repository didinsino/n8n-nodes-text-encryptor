import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { encryptString, decryptString } from './functions';

const DEFAULT_SECRET_KEY = 'FOmd23PkX0QxHJc7S59sEjg6FmaRmCef';

export class TextEncryptor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Text Encryptor',
		name: 'textEncryptor',
		icon: { light: 'file:textEncryptor.icon.svg', dark: 'file:textEncryptor.icon.svg' },
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
				description: 'Choose whether to encrypt or decrypt the text',
				required: true,
				options: [
					{
						name: 'Encrypt',
						value: 'encrypt',
						description: 'Encrypt the provided text',
					},
					{
						name: 'Decrypt',
						value: 'decrypt',
						description: 'Decrypt the provided text',
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
				placeholder: 'Add secret key',
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
				]
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let text: string;

		const returnItems: INodeExecutionData[] = [];
		const options = this.getNodeParameter('options', 0) as any;
		const operation = this.getNodeParameter('operation', 0) as string;
		const secretKey = options.secretKey || DEFAULT_SECRET_KEY;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				text = this.getNodeParameter('text', itemIndex, '') as string;
				item = items[itemIndex];

				const result = operation === 'encrypt' ? encryptString(text, secretKey) : decryptString(text, secretKey);

				item.json = {
					original: text,
					operation,
					result,
				}
				returnItems.push(item);
			} catch (error) {
				// ERR_OSSL_BAD_DECRYPT
				// console.log('CODE::::', error.code);
				if (error.code === 'ERR_OSSL_BAD_DECRYPT' && operation === 'decrypt') {
					error.message = 'Invalid secret key';
				} else if (error.code === 'ERR_CRYPTO_INVALID_IV' && operation === 'decrypt') {
					error.message = 'Encrypted text is invalid or corrupted.';
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
