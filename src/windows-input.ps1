param([switch]$SelfTest)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
public static class PongkanInputReader {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32.dll")]
  static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")]
  static extern bool AllocConsole();
  [DllImport("kernel32.dll")]
  static extern bool GetConsoleMode(IntPtr handle, out uint mode);
  [DllImport("kernel32.dll")]
  static extern bool SetConsoleMode(IntPtr handle, uint mode);
  [StructLayout(LayoutKind.Explicit, Size=20, CharSet=CharSet.Unicode)]
  struct InputRecord {
    [FieldOffset(0)] public ushort type;
    [FieldOffset(4)] public int down;
    [FieldOffset(8)] public ushort repeat;
    [FieldOffset(10)] public ushort key;
    [FieldOffset(14)] public char character;
    [FieldOffset(16)] public uint controls;
    [FieldOffset(4)] public short x;
    [FieldOffset(6)] public short y;
    [FieldOffset(8)] public uint buttons;
    [FieldOffset(16)] public uint flags;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)]
  static extern bool WriteConsoleInputW(IntPtr handle, InputRecord[] records, uint count, out uint written);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool ReadConsoleInputW(IntPtr handle, [Out] InputRecord[] records, uint count, out uint read);
  public static void Run(bool selfTest) {
    if (selfTest) AllocConsole();
    IntPtr handle = CreateFileW("CONIN$", 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    if (handle == new IntPtr(-1)) throw new System.ComponentModel.Win32Exception();
    uint original = 0;
    try {
      if (!GetConsoleMode(handle, out original)) throw new System.ComponentModel.Win32Exception();
      // Read native records, with line input, Quick Edit and VT translation off.
      // Quick Edit otherwise lets a click pause the entire console application.
      if (!SetConsoleMode(handle, (original | 0x0090u) & ~0x0247u))
        throw new System.ComponentModel.Win32Exception();
      if (selfTest) {
        string sample = "hello\r";
        InputRecord[] records = new InputRecord[sample.Length + 16];
        records[0] = new InputRecord { type = 2, x = 11, y = 7, buttons = 120u << 16, flags = 4 };
        records[1] = new InputRecord { type = 2, x = 11, y = 7, buttons = unchecked((uint)-120) << 16, flags = 4 };
        records[2] = new InputRecord { type = 1, down = 1, repeat = 1, key = 9 };
        records[3] = new InputRecord { type = 1, down = 1, repeat = 1, key = 113 };
        records[4] = new InputRecord { type = 1, down = 1, repeat = 1, key = 38 };
        records[5] = new InputRecord { type = 1, down = 1, repeat = 1, key = 8 };
        records[6] = new InputRecord { type = 1, down = 0, repeat = 1, character = 'x' };
        records[7] = new InputRecord { type = 1, down = 1, repeat = 1, key = 33 };
        records[8] = new InputRecord { type = 1, down = 1, repeat = 1, key = 34 };
        records[9] = new InputRecord { type = 1, down = 1, repeat = 1, key = 36 };
        records[10] = new InputRecord { type = 1, down = 1, repeat = 1, key = 35 };
        records[11] = new InputRecord { type = 1, down = 1, repeat = 1, key = 40 };
        records[12] = new InputRecord { type = 1, down = 1, repeat = 1, key = 39, controls = 16 };
        records[13] = new InputRecord { type = 1, down = 1, repeat = 1, key = 113, controls = 16 };
        records[14] = new InputRecord { type = 1, down = 1, repeat = 1, key = 9, controls = 16 };
        records[15] = new InputRecord { type = 1, down = 1, repeat = 1, key = 13, character = '\r', controls = 16 };
        for (int i = 0; i < sample.Length; i++)
          records[i + 16] = new InputRecord { type = 1, down = 1, repeat = 1, character = sample[i] };
        uint written;
        if (!WriteConsoleInputW(handle, records, (uint)records.Length, out written))
          throw new System.ComponentModel.Win32Exception();
      }
      Stream output = Console.OpenStandardOutput();
      // The parent waits for readiness before enabling terminal mouse reports.
      output.WriteByte(0); output.Flush();
      InputRecord[] buffer = new InputRecord[128];
      Encoder encoder = new UTF8Encoding(false).GetEncoder();
      while (true) {
        uint read;
        if (!ReadConsoleInputW(handle, buffer, (uint)buffer.Length, out read))
          throw new System.ComponentModel.Win32Exception();
        if (read == 0) continue;
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < read; i++) {
          InputRecord record = buffer[i];
          if (record.type == 2) {
            if (record.flags == 4) {
              int button = (short)(record.buttons >> 16) > 0 ? 64 : 65;
              text.Append("\x1b[<" + button + ";" + (record.x + 1) + ";" + (record.y + 1) + "M");
            } else if (record.flags == 0 && record.buttons == 1) {
              text.Append("\x1b[<0;" + (record.x + 1) + ";" + (record.y + 1) + "M");
            }
            continue;
          }
          if (record.type != 1 || record.down == 0) continue;
          string keyText = record.character == '\0' ? "" : record.character.ToString();
          switch (record.key) {
            case 8: keyText = "\x7f"; break;
            case 9: keyText = (record.controls & 16) != 0 ? "\x1b[Z" : "\t"; break;
            case 13: keyText = (record.controls & 16) != 0 ? "\x1b[13;2u" : "\r"; break;
            case 33: keyText = "\x1b[5~"; break;
            case 34: keyText = "\x1b[6~"; break;
            case 35: keyText = "\x1b[F"; break;
            case 36: keyText = "\x1b[H"; break;
            case 37: keyText = "\x1b[D"; break;
            case 38: keyText = "\x1b[A"; break;
            case 39: keyText = "\x1b[C"; break;
            case 40: keyText = "\x1b[B"; break;
            case 46: keyText = "\x1b[3~"; break;
            case 112: keyText = "\x1bOP"; break;
            case 113: keyText = (record.controls & 16) != 0 ? "\x1b[1;2Q" : "\x1bOQ"; break;
          }
          // Preserve modified navigation, including the Shift+Right answer shortcut.
          int modifier = 1 + ((record.controls & 16) != 0 ? 1 : 0)
            + ((record.controls & 3) != 0 ? 2 : 0) + ((record.controls & 12) != 0 ? 4 : 0);
          if (modifier > 1 && record.key >= 35 && record.key <= 40)
            keyText = "\x1b[1;" + modifier + keyText.Substring(keyText.Length - 1);
          else if ((record.controls & 3) != 0 && keyText.Length == 1)
            keyText = "\x1b" + keyText;
          for (int repeat = 0; repeat < Math.Max(1, (int)record.repeat); repeat++) text.Append(keyText);
        }
        char[] chars = text.ToString().ToCharArray();
        byte[] bytes = new byte[encoder.GetByteCount(chars, 0, chars.Length, false)];
        int count = encoder.GetBytes(chars, 0, chars.Length, bytes, 0, false);
        output.Write(bytes, 0, count); output.Flush();
        if (selfTest && text.ToString().Contains("\r")) break;
      }
    } finally { if (selfTest) SetConsoleMode(handle, original); CloseHandle(handle); }
  }
}
'@
[PongkanInputReader]::Run([bool]$SelfTest)
