    import prisma from '../../database/prisma.js'

    export async function createClient(companyId, data){
        if (!data || Object.keys(data).length === 0) {
            throw new Error('Nenhum campo válido enviado para atualização');
        }

        return prisma.client.create({
            data: {
                ...data,
                companyId
            }
        });
    };

    export async function getAllClients(companyId){
        return prisma.client.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" }
        });
    };

    export async function getClientById(companyId, id){
        return prisma.client.findFirst({
            where: {
                id,
                companyId
            }
        });
    };

    export async function updateClient(companyId, id, data) {

        if (!data || Object.keys(data).length === 0) {
            throw new Error('Nenhum campo válido enviado para atualização');
        }

        const existingClient = await prisma.client.findFirst({
            where: { id, companyId }
        });

        if (!existingClient) {
            throw new Error('Cliente não encontrado!');
        }

        return prisma.client.update({
            where: { id, companyId },
            data
        });
    }

    export async function deleteClient(companyId, id) {
        return prisma.client.delete({
            where: {
                id,
                companyId
            }
        })
    }