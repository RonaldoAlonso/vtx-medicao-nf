-- Contratantes (clientes)
create table if not exists contratantes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  cnpj text not null,
  endereco text,
  cep text,
  municipio text,
  uf text,
  email text,
  email_nf text,
  inscricao_municipal text,
  inscricao_estadual text,
  discriminacao_adicional text,
  -- Representante legal (usado na geração do contrato Word)
  rep_nome text,
  rep_nacionalidade text,
  rep_estado_civil text,
  rep_profissao text,
  rep_rg text,
  rep_cpf text,
  rep_cidade_uf text,
  created_at timestamptz default now()
);

-- Contratos
create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  contratante_id uuid references contratantes(id),
  obra text not null,
  unidade_construtiva text,
  valor_total numeric(15,2) not null,
  data_inicio date,
  data_fim date,
  ativo boolean default true,
  -- Campos para geração do contrato Word (.docx)
  objeto_resumido text,
  objeto_municipio_uf text,
  objeto_vinculacao text,
  prazo_vigencia_extenso text,
  local_assinatura text,
  data_assinatura date,
  created_at timestamptz default now()
);

-- Serviços do contrato (Cláusula Primeira) — lista flexível
create table if not exists contrato_servicos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id) on delete cascade,
  descricao text not null,
  ordem integer
);

-- Itens de contrato (planilha orçamentária)
create table if not exists contrato_itens (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id) on delete cascade,
  referencia text not null,
  descricao text not null,
  unidade text,
  quantidade numeric(15,4),
  preco_unitario numeric(15,4),
  subtotal numeric(15,2) generated always as (quantidade * preco_unitario) stored,
  ordem integer
);

-- Boletins de Medição
create table if not exists boletins (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id),
  numero_medicao integer not null,
  data_medicao date not null,
  data_vencimento date,
  status text default 'rascunho', -- rascunho | aprovado | nf_emitida
  valor_bruto numeric(15,2),
  valor_retencao numeric(15,2) default 0,
  valor_liquido numeric(15,2),
  observacoes text,
  arquivo_url text,
  created_at timestamptz default now()
);

-- Itens medidos no boletim
create table if not exists boletim_itens (
  id uuid primary key default gen_random_uuid(),
  boletim_id uuid references boletins(id) on delete cascade,
  contrato_item_id uuid references contrato_itens(id),
  referencia text not null,
  descricao text not null,
  unidade text,
  quantidade_contratada numeric(15,4),
  preco_unitario numeric(15,4),
  subtotal numeric(15,2),
  acumulado_anterior numeric(15,2) default 0,
  perc_acumulado_anterior numeric(5,4) default 0,
  valor_medido numeric(15,2) default 0,
  perc_atual numeric(5,4) default 0,
  saldo numeric(15,2),
  perc_saldo numeric(5,4) default 0,
  observacao text
);

-- Notas Fiscais
create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  boletim_id uuid references boletins(id),
  numero_nf text,
  discriminacao_servicos text not null,
  valor_servicos numeric(15,2) not null,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  status text default 'aguardando', -- aguardando | emitida | paga
  nf_xml text,
  nf_pdf_url text,
  protocolo_prefeitura text,
  created_at timestamptz default now()
);

-- Configurações da empresa emissora
create table if not exists config_empresa (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null,
  inscricao_municipal text,
  codigo_servico text default '07498',
  aliquota_iss numeric(5,4) default 0.02,
  regime_tributario integer default 1, -- 1 = Simples Nacional
  banco text,
  agencia text,
  conta text,
  pix text,
  discriminacao_padrao_pagamento text,
  pfx_filename text,
  pfx_senha_hint text
);
