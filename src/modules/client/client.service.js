import prisma from '../../database/prisma.js'
import { AppError } from '../../utils/AppError.js';

import { createWithSequence } from '../../utils/createWithSequence.js';

export async function createClient(companyId, data) {

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Dados do cliente não fornecidos', 400);
    }

    if (!data.name) {
        throw new AppError('O nome do cliente é obrigatório', 400);
    }

    if (!data.document) {
        throw new AppError('Documento é obrigatório', 400);
    }

    return createWithSequence('client', companyId, data);
}

export async function getAllClients(companyId) {
    return prisma.client.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" }
    });
}

export async function getClientById(companyId, id) {
    const client = await prisma.client.findFirst({
        where: { id, companyId }
    });

    // 404: Not Found
    if (!client) {
        throw new AppError('Cliente não encontrado', 404);
    }

    return client;
}

export async function updateClient(companyId, id, data) {
    // Primeiro garantimos que o cliente existe e pertence à empresa
    await getClientById(companyId, id);

    if (!data || Object.keys(data).length === 0) {
        throw new AppError('Nenhum campo válido enviado para atualização', 400);
    }

    return prisma.client.update({
        where: { id },
        data
    });
}

export async function deleteClient(companyId, id) {
    // Verifica existência antes de deletar para evitar erro 500 do Prisma
    await getClientById(companyId, id);

    return prisma.client.delete({
        where: { id }
    });
}

export async function deleteManyClient(companyId, ids) {
    return prisma.client.deleteMany({
        where: {
            companyId,
            id: {
                in: ids
            }
        }
    })
}