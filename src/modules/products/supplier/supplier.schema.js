import { z } from 'zod';

export const createSupplierSchema = z.object({
    name: 
        z.string()
        .min(2, "O nome precisa ter mais que 2 caracteres")
        .max(55),

    document: 
        z.string().min(8),

    email:
        z.email(),
    
    phone: 
        z.string()
        .min(8)
        .max(11),

    // product:
    //     z.string().optional
}).strict()