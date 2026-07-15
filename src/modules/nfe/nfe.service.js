import prisma from '../../database/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createWithSequence } from '../../utils/createWithSequence.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { focusNfeClient, BASE_URLS } from './focusNfeClient.js';
import logger from '../../utils/logger.js';

const onlyDigits = (v) => (v ? String(v).replace(/\D/g, '') : v);

// Os caminhos retornados pela Focus NFe são relativos ao domínio do ambiente usado na emissão
function toAbsoluteUrl(path, ambiente) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URLS[ambiente] || BASE_URLS.producao}${path}`;
}

function tokenFor(config) {
  const enc = config.ambiente === 'producao' ? config.tokenProducaoEnc : config.tokenHomologacaoEnc;
  if (!enc) {
    throw new AppError(
      `Empresa não possui token de ${config.ambiente} configurado. Recadastre o certificado.`,
      422
    );
  }
  return decryptSecret(enc);
}

// Serializa a empresa (Focus) escondendo os tokens; usado nas respostas ao frontend
function serializeConfig(config) {
  if (!config) return null;
  return {
    ambiente: config.ambiente,
    habilitado: config.habilitado,
    certificadoValidoDe: config.certificadoValidoDe,
    certificadoValidoAte: config.certificadoValidoAte,
    certificadoCnpj: config.certificadoCnpj,
    serieNfeProducao: config.serieNfeProducao,
    serieNfeHomologacao: config.serieNfeHomologacao,
    naturezaOperacaoPadrao: config.naturezaOperacaoPadrao,
    possuiTokenProducao: Boolean(config.tokenProducaoEnc),
    possuiTokenHomologacao: Boolean(config.tokenHomologacaoEnc),
  };
}

export const nfeService = {
  async getConfig(companyId) {
    const config = await prisma.nfeConfig.findUnique({ where: { companyId } });
    return serializeConfig(config);
  },

  // Cadastra ou atualiza a empresa na Focus NFe (certificado, IE, regime tributário)
  async configureCompany(companyId, data) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError('Empresa não encontrada', 404);

    const document = onlyDigits(company.document);
    if (!document) {
      throw new AppError('Cadastre o CNPJ da empresa em Configurações > Empresa antes de habilitar a NFe', 400);
    }

    const {
      ie,
      regimeTributario,
      cnae,
      certificadoBase64,
      senhaCertificado,
    } = data;

    if (certificadoBase64 && !senhaCertificado) {
      throw new AppError('Informe a senha do certificado digital', 400);
    }

    const existingConfig = await prisma.nfeConfig.findUnique({ where: { companyId } });

    const focusPayload = {
      nome: company.legalName || company.name,
      nome_fantasia: company.name,
      cnpj: document,
      inscricao_estadual: ie ? onlyDigits(ie) : undefined,
      regime_tributario: regimeTributario || undefined,
      logradouro: company.street || undefined,
      numero: company.number || undefined,
      complemento: company.complement || undefined,
      bairro: company.neighborhood || undefined,
      cep: company.zipCode ? onlyDigits(company.zipCode) : undefined,
      municipio: company.city || undefined,
      uf: company.state || undefined,
      email: company.email || undefined,
      telefone: company.phone || undefined,
      habilita_nfe: true,
    };

    if (certificadoBase64) {
      focusPayload.arquivo_certificado_base64 = certificadoBase64;
      focusPayload.senha_certificado = senhaCertificado;
    }

    // O cadastro/atualização de empresa é uma operação de conta (nível de contrato Focus NFe),
    // documentada apenas no domínio de produção; o token retornado serve para os dois ambientes de emissão.
    const setupAmbiente = 'producao';
    const setupToken = process.env.FOCUS_NFE_ACCOUNT_TOKEN;
    if (!setupToken) {
      throw new AppError('FOCUS_NFE_ACCOUNT_TOKEN não configurado no servidor', 500);
    }

    let response;
    if (existingConfig?.focusEmpresaId) {
      response = await focusNfeClient.atualizarEmpresa(setupAmbiente, setupToken, existingConfig.focusEmpresaId, focusPayload);
    } else {
      response = await focusNfeClient.criarEmpresa(setupAmbiente, setupToken, focusPayload);
    }

    if (response.status >= 400) {
      const msg = response.data?.erros?.[0]?.mensagem || response.data?.mensagem || 'Erro ao configurar empresa na Focus NFe';
      logger.warn({ msg: '[nfeService] Erro ao configurar empresa', status: response.status, data: response.data });
      throw new AppError(msg, 422);
    }

    const focusData = response.data;

    const config = await prisma.nfeConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        focusEmpresaId: focusData.id,
        habilitado: Boolean(focusData.habilita_nfe),
        tokenProducaoEnc: focusData.token_producao ? encryptSecret(focusData.token_producao) : null,
        tokenHomologacaoEnc: focusData.token_homologacao ? encryptSecret(focusData.token_homologacao) : null,
        certificadoValidoDe: focusData.certificado_valido_de ? new Date(focusData.certificado_valido_de) : null,
        certificadoValidoAte: focusData.certificado_valido_ate ? new Date(focusData.certificado_valido_ate) : null,
        certificadoCnpj: focusData.certificado_cnpj || null,
      },
      update: {
        focusEmpresaId: focusData.id,
        habilitado: Boolean(focusData.habilita_nfe),
        ...(focusData.token_producao ? { tokenProducaoEnc: encryptSecret(focusData.token_producao) } : {}),
        ...(focusData.token_homologacao ? { tokenHomologacaoEnc: encryptSecret(focusData.token_homologacao) } : {}),
        certificadoValidoDe: focusData.certificado_valido_de ? new Date(focusData.certificado_valido_de) : undefined,
        certificadoValidoAte: focusData.certificado_valido_ate ? new Date(focusData.certificado_valido_ate) : undefined,
        certificadoCnpj: focusData.certificado_cnpj || undefined,
      },
    });

    await prisma.company.update({
      where: { id: companyId },
      data: {
        ie: ie ?? undefined,
        regimeTributario: regimeTributario ?? undefined,
        cnae: cnae ?? undefined,
      },
    });

    return serializeConfig(config);
  },

  async setAmbiente(companyId, ambiente) {
    if (!['homologacao', 'producao'].includes(ambiente)) {
      throw new AppError('Ambiente inválido', 400);
    }
    const config = await prisma.nfeConfig.findUnique({ where: { companyId } });
    if (!config) throw new AppError('Empresa ainda não configurada para NFe', 400);

    const tokenField = ambiente === 'producao' ? 'tokenProducaoEnc' : 'tokenHomologacaoEnc';
    if (!config[tokenField]) {
      throw new AppError(`Token de ${ambiente} ainda não disponível para esta empresa`, 422);
    }

    const updated = await prisma.nfeConfig.update({ where: { companyId }, data: { ambiente } });
    return serializeConfig(updated);
  },

  // Lista as notas fiscais da empresa (todas as emissões, com pedido e cliente)
  async list(companyId, { page = 1, limit = 25, status, search } = {}) {
    const where = { companyId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { numero: { contains: search } },
        { chaveNfe: { contains: search } },
        { sale: { client: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * limit;
    const [emissions, total] = await Promise.all([
      prisma.nfeEmission.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              cod: true,
              total: true,
              date: true,
              client: { select: { id: true, name: true, document: true } },
            },
          },
          paymentMethod: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.nfeEmission.count({ where }),
    ]);

    return {
      emissions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  // Cria (ou retorna) o rascunho de NFe de um pedido, para conferência antes do envio
  async createDraft(companyId, saleId) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: { nfeEmission: true },
    });
    if (!sale) throw new AppError('Venda não encontrada', 404);

    if (sale.nfeEmission) return this.getEmissionById(companyId, sale.nfeEmission.id);

    const now = new Date();
    const emission = await createWithSequence('nfeEmission', companyId, {
      saleId,
      ref: `sale${sale.cod}c${companyId.slice(0, 8)}`.replace(/[^a-zA-Z0-9]/g, ''),
      status: 'PENDENTE',
      dataEmissao: now,
      dataSaida: now,
      paymentMethodId: sale.paymentMethodId || null,
    });

    return this.getEmissionById(companyId, emission.id);
  },

  async getEmissionById(companyId, emissionId) {
    const emission = await prisma.nfeEmission.findFirst({
      where: { id: emissionId, companyId },
      include: {
        sale: {
          select: {
            id: true,
            cod: true,
            total: true,
            subtotal: true,
            discount: true,
            freight: true,
            date: true,
            client: { select: { id: true, name: true, document: true } },
          },
        },
        paymentMethod: { select: { id: true, name: true } },
      },
    });
    if (!emission) throw new AppError('Nota fiscal não encontrada', 404);
    return emission;
  },

  // Atualiza os campos de conferência do rascunho (antes do envio à SEFAZ)
  async updateDraft(companyId, emissionId, { dataEmissao, dataSaida, paymentMethodId }) {
    const emission = await prisma.nfeEmission.findFirst({ where: { id: emissionId, companyId } });
    if (!emission) throw new AppError('Nota fiscal não encontrada', 404);
    if (!['PENDENTE', 'ERRO'].includes(emission.status)) {
      throw new AppError('Só é possível editar uma nota que ainda não foi enviada', 422);
    }

    if (paymentMethodId) {
      const pm = await prisma.paymentMethod.findFirst({ where: { id: paymentMethodId, companyId } });
      if (!pm) throw new AppError('Forma de pagamento inválida', 400);
    }

    await prisma.nfeEmission.update({
      where: { id: emission.id },
      data: {
        dataEmissao: dataEmissao ? new Date(dataEmissao) : undefined,
        dataSaida: dataSaida ? new Date(dataSaida) : undefined,
        paymentMethodId: paymentMethodId === null ? null : paymentMethodId || undefined,
      },
    });

    return this.getEmissionById(companyId, emission.id);
  },

  // Monta o payload de emissão a partir do pedido de venda
  async buildNfePayload(companyId, sale, config, emission = null) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const client = sale.client;

    if (!company.document) throw new AppError('Empresa sem CNPJ cadastrado', 422);
    if (!company.ie) throw new AppError('Empresa sem inscrição estadual cadastrada', 422);
    if (!company.regimeTributario) throw new AppError('Empresa sem regime tributário cadastrado', 422);
    if (!client.document) throw new AppError('Cliente sem CPF/CNPJ cadastrado', 422);

    const items = [];
    for (const [index, item] of sale.items.entries()) {
      const tax = item.product?.tax;
      if (!tax?.ncm) {
        throw new AppError(`Produto "${item.product?.description}" está sem NCM cadastrado (Configurações fiscais do produto)`, 422);
      }
      if (!tax?.cfop) {
        throw new AppError(`Produto "${item.product?.description}" está sem CFOP cadastrado (Configurações fiscais do produto)`, 422);
      }

      const valorBruto = Number(item.unitPrice) * item.quantity;
      items.push({
        numero_item: index + 1,
        codigo_produto: item.product.code || item.product.id,
        descricao: item.product.description,
        cfop: tax.cfop,
        quantidade_comercial: item.quantity,
        quantidade_tributavel: item.quantity,
        valor_unitario_comercial: Number(item.unitPrice),
        valor_unitario_tributavel: Number(item.unitPrice),
        unidade_comercial: item.product.unit || 'UN',
        unidade_tributavel: item.product.unit || 'UN',
        valor_bruto: valorBruto,
        valor_desconto: Number(item.discount || 0),
        codigo_ncm: tax.ncm,
        inclui_no_total: 1,
        icms_origem: tax.origin ? Number(tax.origin) : 0,
        icms_situacao_tributaria: tax.icmsCst || '102',
        pis_situacao_tributaria: tax.pisCst || '07',
        cofins_situacao_tributaria: tax.cofinsCst || '07',
      });
    }

    const isPessoaFisica = client.type === 'PF';
    const indicadorIE = client.indicatorIE ?? (client.ie ? 1 : 9);

    return {
      natureza_operacao: sale.naturezaOperacao || config.naturezaOperacaoPadrao,
      data_emissao: (emission?.dataEmissao || new Date()).toISOString(),
      data_entrada_saida: (emission?.dataSaida || emission?.dataEmissao || new Date()).toISOString(),
      tipo_documento: sale.tipoDocumento,
      local_destino: sale.localDestino,
      finalidade_emissao: sale.finalidadeEmissao,
      consumidor_final: sale.consumidorFinal,
      presenca_comprador: sale.presencaComprador,
      modalidade_frete: sale.modalidadeFrete,

      cnpj_emitente: onlyDigits(company.document),
      nome_emitente: company.legalName || company.name,
      nome_fantasia_emitente: company.name,
      logradouro_emitente: company.street,
      numero_emitente: company.number,
      bairro_emitente: company.neighborhood,
      municipio_emitente: company.city,
      uf_emitente: company.state,
      cep_emitente: onlyDigits(company.zipCode),
      inscricao_estadual_emitente: onlyDigits(company.ie),
      regime_tributario_emitente: company.regimeTributario,

      nome_destinatario: client.name,
      [isPessoaFisica ? 'cpf_destinatario' : 'cnpj_destinatario']: onlyDigits(client.document),
      inscricao_estadual_destinatario: client.ie ? onlyDigits(client.ie) : undefined,
      indicador_inscricao_estadual_destinatario: indicadorIE,
      logradouro_destinatario: client.street,
      numero_destinatario: client.number,
      bairro_destinatario: client.neighborhood,
      municipio_destinatario: client.city,
      uf_destinatario: client.state,
      cep_destinatario: onlyDigits(client.zipCode),
      pais_destinatario: 'Brasil',
      telefone_destinatario: client.phone || undefined,

      valor_frete: Number(sale.freight || 0),
      valor_seguro: 0,
      valor_desconto: Number(sale.discount || 0),
      valor_outras_despesas: 0,
      valor_produtos: Number(sale.subtotal),
      valor_total: Number(sale.total),

      items,
    };
  },

  async emit(companyId, saleId) {
    const config = await prisma.nfeConfig.findUnique({ where: { companyId } });
    if (!config || !config.habilitado) {
      throw new AppError('Empresa não está habilitada para emissão de NFe. Configure em Configurações > Nota Fiscal', 422);
    }

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: {
        client: true,
        items: { include: { product: { include: { tax: true } } } },
        nfeEmission: true,
      },
    });
    if (!sale) throw new AppError('Venda não encontrada', 404);

    if (sale.nfeEmission?.status === 'AUTORIZADO') {
      throw new AppError('Esta venda já possui uma NFe autorizada', 422);
    }
    if (sale.nfeEmission?.status === 'PROCESSANDO') {
      throw new AppError('Esta venda já possui uma NFe em processamento', 422);
    }

    let emission = sale.nfeEmission;
    if (!emission) {
      const now = new Date();
      emission = await createWithSequence('nfeEmission', companyId, {
        saleId,
        ref: `sale${sale.cod}c${companyId.slice(0, 8)}`.replace(/[^a-zA-Z0-9]/g, ''),
        status: 'PENDENTE',
        dataEmissao: now,
        dataSaida: now,
        paymentMethodId: sale.paymentMethodId || null,
      });
    }

    const payload = await this.buildNfePayload(companyId, sale, config, emission);
    const token = tokenFor(config);

    const response = await focusNfeClient.emitirNfe(config.ambiente, token, emission.ref, payload);

    if (response.status === 400 || response.status === 415) {
      return prisma.nfeEmission.update({
        where: { id: emission.id },
        data: { status: 'ERRO', mensagemSefaz: response.data?.mensagem, erros: response.data?.erros || response.data },
      });
    }

    if (response.status === 422) {
      return prisma.nfeEmission.update({
        where: { id: emission.id },
        data: { status: 'ERRO', mensagemSefaz: response.data?.mensagem, erros: response.data?.erros || response.data },
      });
    }

    const data = response.data;
    return prisma.nfeEmission.update({
      where: { id: emission.id },
      data: {
        status: data.status === 'autorizado' ? 'AUTORIZADO' : data.status === 'erro_autorizacao' ? 'ERRO' : 'PROCESSANDO',
        statusSefaz: data.status_sefaz || null,
        mensagemSefaz: data.mensagem_sefaz || null,
        chaveNfe: data.chave_nfe || null,
        numero: data.numero || null,
        serie: data.serie || null,
        caminhoXml: toAbsoluteUrl(data.caminho_xml_nota_fiscal, config.ambiente),
        caminhoDanfe: toAbsoluteUrl(data.caminho_danfe, config.ambiente),
        erros: data.erros || null,
      },
    });
  },

  async getStatus(companyId, saleId) {
    const emission = await prisma.nfeEmission.findFirst({ where: { saleId, companyId } });
    if (!emission) return null;

    if (emission.status !== 'PROCESSANDO') return emission;

    const config = await prisma.nfeConfig.findUnique({ where: { companyId } });
    const token = tokenFor(config);
    const response = await focusNfeClient.consultarNfe(config.ambiente, token, emission.ref);
    const data = response.data;

    if (data.status === emission.status) return emission;

    return prisma.nfeEmission.update({
      where: { id: emission.id },
      data: {
        status: data.status === 'autorizado' ? 'AUTORIZADO' : data.status === 'erro_autorizacao' ? 'ERRO' : data.status === 'cancelado' ? 'CANCELADO' : 'PROCESSANDO',
        statusSefaz: data.status_sefaz || null,
        mensagemSefaz: data.mensagem_sefaz || null,
        chaveNfe: data.chave_nfe || emission.chaveNfe,
        numero: data.numero || emission.numero,
        serie: data.serie || emission.serie,
        caminhoXml: toAbsoluteUrl(data.caminho_xml_nota_fiscal, config.ambiente) || emission.caminhoXml,
        caminhoDanfe: toAbsoluteUrl(data.caminho_danfe, config.ambiente) || emission.caminhoDanfe,
        erros: data.erros || null,
      },
    });
  },

  async cancel(companyId, saleId, justificativa) {
    if (!justificativa || justificativa.length < 15 || justificativa.length > 255) {
      throw new AppError('Justificativa deve ter entre 15 e 255 caracteres', 400);
    }

    const emission = await prisma.nfeEmission.findFirst({ where: { saleId, companyId } });
    if (!emission) throw new AppError('Nenhuma NFe encontrada para esta venda', 404);
    if (emission.status !== 'AUTORIZADO') {
      throw new AppError('Só é possível cancelar uma NFe autorizada', 422);
    }

    const config = await prisma.nfeConfig.findUnique({ where: { companyId } });
    const token = tokenFor(config);
    const response = await focusNfeClient.cancelarNfe(config.ambiente, token, emission.ref, justificativa);

    if (response.status >= 400) {
      const msg = response.data?.mensagem || 'Erro ao cancelar NFe';
      throw new AppError(msg, 422);
    }

    return prisma.nfeEmission.update({
      where: { id: emission.id },
      data: {
        status: 'CANCELADO',
        statusSefaz: response.data.status_sefaz || null,
        mensagemSefaz: response.data.mensagem_sefaz || null,
        justificativaCancelamento: justificativa,
        canceladoEm: new Date(),
      },
    });
  },

  // Processa a notificação assíncrona da Focus NFe (webhook)
  async handleWebhook(payload) {
    const { ref, status } = payload;
    if (!ref) {
      logger.warn({ msg: '[nfeService] Webhook sem ref', payload });
      return;
    }

    const emission = await prisma.nfeEmission.findUnique({ where: { ref } });
    if (!emission) {
      logger.warn({ msg: '[nfeService] Webhook para ref desconhecida', ref });
      return;
    }

    const config = await prisma.nfeConfig.findUnique({ where: { companyId: emission.companyId } });
    const ambiente = config?.ambiente || 'producao';

    const statusMap = {
      autorizado: 'AUTORIZADO',
      erro_autorizacao: 'ERRO',
      cancelado: 'CANCELADO',
      processando_autorizacao: 'PROCESSANDO',
    };

    await prisma.nfeEmission.update({
      where: { id: emission.id },
      data: {
        status: statusMap[status] || emission.status,
        statusSefaz: payload.status_sefaz || emission.statusSefaz,
        mensagemSefaz: payload.mensagem_sefaz || emission.mensagemSefaz,
        chaveNfe: payload.chave_nfe || emission.chaveNfe,
        numero: payload.numero || emission.numero,
        serie: payload.serie || emission.serie,
        caminhoXml: toAbsoluteUrl(payload.caminho_xml_nota_fiscal, ambiente) || emission.caminhoXml,
        caminhoDanfe: toAbsoluteUrl(payload.caminho_danfe, ambiente) || emission.caminhoDanfe,
        erros: payload.erros || emission.erros,
      },
    });
  },
};
