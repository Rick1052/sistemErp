import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(255, "Nome muito longo"),
    
  type: z.enum(['PF', 'PJ', 'PE'], {
    required_error: "Tipo de cliente é obrigatório",
    invalid_type_error: "Tipo deve ser PF, PJ ou PE"
  }),
  
  // Aumentei o max para 18 para acomodar CNPJ com pontuação (ex: 00.000.000/0000-00)
  document: z.string()
    .min(11, "Documento inválido")
    .max(18, "Documento muito longo"),
  
  ie: z.string().max(20, "Inscrição Estadual muito longa").optional(),
  
  // CORREÇÃO: z.int() substituído por z.number().int()
  indicatorIE: z.number().int("O indicador IE deve ser um número inteiro").optional(),

  email: z.string()
    .email("Email inválido"),

  phone: z.string()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo"),

  street: z.string().min(5, "Logradouro muito curto").max(255),
  number: z.string().min(1, "Número inválido").max(20),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().min(2, "Bairro muito curto").max(100),
  city: z.string().min(2, "Cidade muito curta").max(100),
  state: z.string().length(2, "Use a sigla do estado (UF) com 2 letras"),
  zipCode: z.string().min(8, "CEP inválido").max(10),
  
  // Adicionei um default para facilitar a vida do usuário
  country: z.string().max(50).default('Brasil'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
}).strict();

// CORREÇÃO DE ARQUITETURA:
// O .partial() pega o schema acima e torna todos os campos opcionais. 
// Isso garante que a validação de email, min/max de telefone e tudo mais 
// sejam idênticos na criação e na edição!
export const updateClientSchema = createClientSchema.partial().strict();