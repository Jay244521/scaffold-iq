using UnrealBuildTool;
using System.Collections.Generic;

public class ForgeGamesTarget : TargetRules
{
	public ForgeGamesTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;

		ExtraModuleNames.Add("ForgeGames");
	}
}
