// Bank.cs avisa por UnityEngine.Debug.LogWarning cuando topa el saldo. Dentro
// de Unity eso lo resuelve el propio motor; aquí fuera no existe, así que este
// mínimo sustituto permite compilar el port SIN tocar ni una línea de Assets/.
// Sólo lo compila este arnés: vive fuera de Assets/, Unity nunca lo ve.
namespace UnityEngine
{
    public static class Debug
    {
        public static void Log(object message) { System.Console.WriteLine("[Log] " + message); }
        public static void LogWarning(object message) { System.Console.WriteLine("[Warning] " + message); }
        public static void LogError(object message) { System.Console.WriteLine("[Error] " + message); }
    }
}
