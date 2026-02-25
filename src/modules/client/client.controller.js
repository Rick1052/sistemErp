import { 
    createClient, 
    getAllClients, 
    getClientById, 
    deleteClient,
    updateClient
} from "./client.service.js";

export async function createController(req, res){
    const companyId = req.companyId;

    try {

        const client = await createClient(companyId, req.validatedBody);

        return res.status(200).json(client);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export async function listController(req, res){
    try {
        const companyId = req.companyId;
        
        const clients = await getAllClients(companyId);

        return res.status(200).json(clients)
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export async function getByIdController(req, res) {
    try {
        const companyId = req.companyId;
        const { id } = req.params;

        const client = await getClientById(companyId, id);

        if(!client) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        return res.status(200).json(client);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export async function updateController(req, res) {
    const { id } = req.params;
    const companyId = req.companyId;

    try {
        
        const client = await updateClient(companyId, id, req.validatedBody);

        res.status(200).json(client);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function deleteControler(req, res) {
    try {
        const companyId = req.companyId;
        const { id } = req.params;

        const client = await deleteClient(companyId, id);

        if(!client){
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        return res.status(200).json(client);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}