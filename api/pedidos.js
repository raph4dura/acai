
export default async function handler(req, res) {
  return res.status(200).json({
    teste: true,
    metodo: req.method,
    mensagem: "A função pedidos.js está executando."
  });
}
