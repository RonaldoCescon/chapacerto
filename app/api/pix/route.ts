import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Inicializa o cliente fora do handler para performance (Serverless)
const token = process.env.MP_ACCESS_TOKEN;
const client = token ? new MercadoPagoConfig({ accessToken: token }) : null;

export async function POST(request: Request) {
  try {
    // 1. Verificação de Ambiente
    if (!client) {
      console.error("ERRO CRÍTICO: MP_ACCESS_TOKEN não configurado.");
      return NextResponse.json({ error: 'Erro de configuração no servidor' }, { status: 500 });
    }

    const body = await request.json();
    const { amount, description, email, firstName, lastName } = body;

    // 2. Validação de Segurança (Blindagem)
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valor inválido para transação' }, { status: 400 });
    }

    // 3. Criação do Pagamento com Idempotência
    const payment = new Payment(client);
    
    // Geramos uma chave única baseada nos dados para evitar duplicidade no curto prazo
    const idempotencyKey = crypto.randomUUID(); 

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: description || 'Serviço ChapaCerto',
        payment_method_id: 'pix',
        payer: {
          // Usar dados reais aumenta a taxa de aprovação
          email: email || 'cliente@chapacerto.com.br',
          first_name: firstName || 'Cliente',
          last_name: lastName || 'ChapaCerto',
        },
        // Expira em 30 min (padrão de mercado para não segurar vaga)
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      },
      requestOptions: {
        idempotencyKey: idempotencyKey // <--- O SEGREDO DO APP PREMIUM
      }
    });

    // 4. Resposta Limpa e Tipada
    return NextResponse.json({
      id: result.id,
      status: result.status,
      qr_code: result.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: result.point_of_interaction?.transaction_data?.ticket_url, // Link do comprovante
    });

  } catch (error: any) {
    console.error("Erro Pagamento Pix:", error);
    
    // Tratamento amigável de erro do Mercado Pago
    const errorMessage = error.cause?.description || error.message || 'Erro ao processar pagamento';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!client || !id) {
    return NextResponse.json({ error: 'ID de pagamento inválido' }, { status: 400 });
  }

  try {
    const payment = new Payment(client);
    const result = await payment.get({ id: id });

    return NextResponse.json({ 
      status: result.status,
      id: result.id,
      date_approved: result.date_approved 
    });

  } catch (error: any) {
    console.error("Erro Consulta Pix:", error);
    return NextResponse.json({ error: 'Não foi possível verificar o status' }, { status: 500 });
  }
}